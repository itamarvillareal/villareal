using Microsoft.Extensions.Logging;
using Vilareal.Core.Integrations.TribunalScraper.Abstractions;
using Vilareal.Core.Integrations.TribunalScraper.Models;

namespace Vilareal.Core.Integrations.TribunalScraper.Monitoring;

/// <summary>Health check leve (latência de GET na raiz do tribunal).</summary>
public sealed class TribunalHealthMonitor
{
    private static readonly object Gate = new();
    private static readonly Dictionary<string, Queue<bool>> Recent = new(StringComparer.OrdinalIgnoreCase);

    private readonly ITribunalScraperClient _client;
    private readonly ITribunalScraperFactory _factory;
    private readonly ILogger<TribunalHealthMonitor> _logger;

    public TribunalHealthMonitor(
        ITribunalScraperClient client,
        ITribunalScraperFactory factory,
        ILogger<TribunalHealthMonitor> logger)
    {
        _client = client;
        _factory = factory;
        _logger = logger;
    }

    public async Task<ScraperHealthCheck> CheckHealthAsync(string tribunalCode, CancellationToken cancellationToken = default)
    {
        var entry = _factory.GetAvailableTribunals().FirstOrDefault(t =>
            t.Code.Equals(tribunalCode, StringComparison.OrdinalIgnoreCase));
        if (entry == null)
        {
            return new ScraperHealthCheck
            {
                Tribunal = tribunalCode,
                UltimaExecucao = DateTime.UtcNow,
                Status = "red",
                TaxaSucesso = 0,
                UltimoErro = "Tribunal não configurado.",
            };
        }

        try
        {
            var baseUri = new Uri(entry.BaseUrl.EndsWith("/") ? entry.BaseUrl : entry.BaseUrl + "/");
            _ = await _client.GetAsync(tribunalCode, baseUri, cancellationToken).ConfigureAwait(false);
            Record(tribunalCode, true);
            var rate = SuccessRate(tribunalCode);
            return new ScraperHealthCheck
            {
                Tribunal = tribunalCode,
                UltimaExecucao = DateTime.UtcNow,
                Status = rate >= 0.7m ? "green" : "yellow",
                TaxaSucesso = rate,
                UltimoErro = string.Empty,
            };
        }
        catch (Exception ex)
        {
            Record(tribunalCode, false);
            _logger.LogWarning(ex, "Health falhou para {Tribunal}", tribunalCode);
            return new ScraperHealthCheck
            {
                Tribunal = tribunalCode,
                UltimaExecucao = DateTime.UtcNow,
                Status = "red",
                TaxaSucesso = SuccessRate(tribunalCode),
                UltimoErro = ex.GetType().Name,
            };
        }
    }

    public async Task<IReadOnlyList<ScraperHealthCheck>> GetAllHealthAsync(CancellationToken cancellationToken = default)
    {
        var list = new List<ScraperHealthCheck>();
        foreach (var t in _factory.GetAvailableTribunals().Where(x => x.Active))
            list.Add(await CheckHealthAsync(t.Code, cancellationToken).ConfigureAwait(false));
        return list;
    }

    public Task AlertIfUnhealthyAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("AlertIfUnhealthyAsync: integrar notificações no host Vilareal.Web.");
        return Task.CompletedTask;
    }

    private static void Record(string tribunalCode, bool ok)
    {
        lock (Gate)
        {
            if (!Recent.TryGetValue(tribunalCode, out var q))
            {
                q = new Queue<bool>();
                Recent[tribunalCode] = q;
            }

            q.Enqueue(ok);
            while (q.Count > 10)
                q.Dequeue();
        }
    }

    private static decimal SuccessRate(string tribunalCode)
    {
        lock (Gate)
        {
            if (!Recent.TryGetValue(tribunalCode, out var q) || q.Count == 0)
                return 1m;
            return (decimal)q.Count(x => x) / q.Count;
        }
    }
}
