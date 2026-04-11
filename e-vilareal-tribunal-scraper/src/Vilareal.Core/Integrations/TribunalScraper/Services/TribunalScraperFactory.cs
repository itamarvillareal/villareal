using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Vilareal.Core.Integrations.TribunalScraper.Abstractions;
using Vilareal.Core.Integrations.TribunalScraper.Configuration;
using Vilareal.Core.Integrations.TribunalScraper.Monitoring;
using Vilareal.Core.Integrations.TribunalScraper.Services.Strategies;

namespace Vilareal.Core.Integrations.TribunalScraper.Services;

/// <summary>Fábrica de estratégias conforme família e código do tribunal (MVP: TJSP, TRT2, TSE).</summary>
public sealed class TribunalScraperFactory : ITribunalScraperFactory
{
    private readonly IOptions<TribunalScraperRootConfig> _options;
    private readonly ITribunalScraperClient _client;
    private readonly IHtmlParsingService _html;
    private readonly IMemoryCache _cache;
    private readonly ILoggerFactory _loggerFactory;
    private readonly LayoutChangeDetector _layoutDetector;

    public TribunalScraperFactory(
        IOptions<TribunalScraperRootConfig> options,
        ITribunalScraperClient client,
        IHtmlParsingService html,
        IMemoryCache cache,
        ILoggerFactory loggerFactory,
        LayoutChangeDetector layoutDetector)
    {
        _options = options;
        _client = client;
        _html = html;
        _cache = cache;
        _loggerFactory = loggerFactory;
        _layoutDetector = layoutDetector;
    }

    public ITribunalScraperStrategy CreateScraper(string tribunalCode)
    {
        var entry = _options.Value.Tribunals.FirstOrDefault(t =>
            t.Code.Equals(tribunalCode, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException($"Tribunal '{tribunalCode}' não encontrado na configuração.");

        if (entry.Code.Equals("TJSP", StringComparison.OrdinalIgnoreCase))
        {
            return new TjspScraperStrategy(
                entry,
                _client,
                _html,
                _cache,
                _loggerFactory.CreateLogger<TjspScraperStrategy>(),
                _layoutDetector);
        }

        if (entry.Code.Equals("TRT2", StringComparison.OrdinalIgnoreCase))
        {
            return new Trt2ScraperStrategy(
                entry,
                _client,
                _html,
                _cache,
                _loggerFactory.CreateLogger<Trt2ScraperStrategy>());
        }

        if (entry.Code.Equals("TSE", StringComparison.OrdinalIgnoreCase))
        {
            return new TseScraperStrategy(
                entry,
                _client,
                _html,
                _cache,
                _loggerFactory.CreateLogger<TseScraperStrategy>());
        }

        return entry.Family.ToUpperInvariant() switch
        {
            "ESAJ" => new EsajFamilyStrategy(
                entry,
                _client,
                _html,
                _cache,
                _loggerFactory.CreateLogger<EsajFamilyStrategy>(),
                _layoutDetector),
            "PJE" => new PjeFamilyStrategy(
                entry,
                _client,
                _html,
                _cache,
                _loggerFactory.CreateLogger<PjeFamilyStrategy>()),
            _ => throw new InvalidOperationException($"Família '{entry.Family}' não suportada para o tribunal '{entry.Code}'.")
        };
    }

    public IReadOnlyList<TribunalScraperEntry> GetAvailableTribunals() =>
        _options.Value.Tribunals.Where(t => t.Active).ToList();
}
