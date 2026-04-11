using Microsoft.Extensions.Logging;
using Vilareal.Core.Integrations.TribunalScraper.Abstractions;
using Vilareal.Core.Integrations.TribunalScraper.Exceptions;
using Vilareal.Core.Integrations.TribunalScraper.Models;

namespace Vilareal.Core.Integrations.TribunalScraper.Services;

/// <summary>Orquestra buscas em vários tribunais (paralelismo limitado).</summary>
public sealed class TribunalScraperService : ITribunalScraperService
{
    private readonly ITribunalScraperFactory _factory;
    private readonly LawyerValidator _validator;
    private readonly ILogger<TribunalScraperService> _logger;

    public TribunalScraperService(
        ITribunalScraperFactory factory,
        LawyerValidator validator,
        ILogger<TribunalScraperService> logger)
    {
        _factory = factory;
        _validator = validator;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ProcessoScrapedDto>> SearchByLawyerAsync(
        LawyerSearchRequest request,
        CancellationToken cancellationToken = default)
    {
        var oab = _validator.NormalizeOabNumber(request.OabNumber);
        var tribunals = _factory.GetAvailableTribunals();
        if (request.Spheres is { Count: > 0 })
        {
            var set = new HashSet<string>(request.Spheres.Select(s => s.Trim().ToLowerInvariant()));
            tribunals = tribunals.Where(t => set.Contains(t.Sphere.Trim().ToLowerInvariant())).ToList();
        }

        var semaphore = new SemaphoreSlim(3, 3);
        var tasks = tribunals.Select(async t =>
        {
            await semaphore.WaitAsync(cancellationToken).ConfigureAwait(false);
            try
            {
                var scraper = _factory.CreateScraper(t.Code);
                return await scraper.SearchByLawyerAsync(request.LawyerName, oab, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha no scraping do tribunal {Tribunal}", t.Code);
                return (IReadOnlyList<ProcessoScrapedDto>)Array.Empty<ProcessoScrapedDto>();
            }
            finally
            {
                semaphore.Release();
            }
        });

        var chunks = await Task.WhenAll(tasks).ConfigureAwait(false);
        return chunks.SelectMany(c => c).ToList();
    }

    public Task<ProcessoScrapedDto?> GetProcessDetailsAsync(
        string numeroProcesso,
        string tribunalCode,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("GetProcessDetailsAsync: stub — implementar consulta por CNJ quando integrado ao host.");
        return Task.FromResult<ProcessoScrapedDto?>(null);
    }

    public Task<SyncResult> SyncProcessAsync(string numeroProcesso, string tribunalCode, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(new SyncResult
        {
            Success = false,
            Message = "Linha isolada: persistência NHibernate desativada.",
            NumeroProcesso = numeroProcesso,
            TribunalCode = tribunalCode,
        });
    }

    public Task<IReadOnlyList<PublicacaoScrapedDto>> GetPublicationsAsync(
        string numeroProcesso,
        string tribunalCode,
        DateTime? since,
        CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<PublicacaoScrapedDto>>(Array.Empty<PublicacaoScrapedDto>());

    public Task<IReadOnlyList<SyncHistoryRecord>> GetSyncHistoryAsync(
        int limit,
        SyncFilter? filters,
        CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<SyncHistoryRecord>>(Array.Empty<SyncHistoryRecord>());
}
