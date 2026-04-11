using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Vilareal.Core.Integrations.TribunalScraper.Abstractions;
using Vilareal.Core.Integrations.TribunalScraper.Configuration;
using Vilareal.Core.Integrations.TribunalScraper.Models;

namespace Vilareal.Core.Integrations.TribunalScraper.Services.Strategies;

/// <summary>Base com cache (12 h), chave de cache e cálculo simples de confiança.</summary>
public abstract class BaseTribunalScraperStrategy : ITribunalScraperStrategy
{
    protected readonly TribunalScraperEntry Entry;
    protected readonly ITribunalScraperClient Client;
    protected readonly IHtmlParsingService HtmlParsing;
    protected readonly IMemoryCache Cache;
    protected readonly ILogger Logger;

    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(12);

    protected BaseTribunalScraperStrategy(
        TribunalScraperEntry entry,
        ITribunalScraperClient client,
        IHtmlParsingService htmlParsing,
        IMemoryCache cache,
        ILogger logger)
    {
        Entry = entry;
        Client = client;
        HtmlParsing = htmlParsing;
        Cache = cache;
        Logger = logger;
    }

    public string TribunalCode => Entry.Code;

    public abstract Task<IReadOnlyList<ProcessoScrapedDto>> SearchByLawyerAsync(
        string lawyerName,
        string oabNormalized,
        CancellationToken cancellationToken = default);

    protected string BuildCacheKey(string lawyerName, string oabNormalized) =>
        $"scrape:{TribunalCode}:{oabNormalized}:{lawyerName.Trim().ToUpperInvariant()}";

    protected bool TryGetCache(string key, out IReadOnlyList<ProcessoScrapedDto>? data)
    {
        if (Cache.TryGetValue(key, out IReadOnlyList<ProcessoScrapedDto>? cached))
        {
            data = cached;
            return true;
        }

        data = null;
        return false;
    }

    protected void SaveCache(string key, IReadOnlyList<ProcessoScrapedDto> data) =>
        Cache.Set(key, data, CacheDuration);

    /// <summary>Log sem conteúdo sensível (evitar partes completas / HTML).</summary>
    protected void LogSearchStart(string oabNormalized)
    {
        Logger.LogInformation("Busca scraping tribunal={Tribunal} oab={Oab}", TribunalCode, oabNormalized);
    }

    protected static int CalculateConfidence(ProcessoScrapedDto p)
    {
        var score = 40;
        if (!string.IsNullOrWhiteSpace(p.NumeroProcesso)) score += 20;
        if (!string.IsNullOrWhiteSpace(p.Classe)) score += 15;
        if (p.Assuntos.Count > 0) score += 10;
        if (p.Partes.Count > 0) score += 10;
        if (p.DataAjuizamento.HasValue) score += 5;
        return Math.Min(100, score);
    }
}
