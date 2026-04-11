using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Vilareal.Core.Integrations.TribunalScraper.Abstractions;
using Vilareal.Core.Integrations.TribunalScraper.Configuration;
using Vilareal.Core.Integrations.TribunalScraper.Exceptions;
using Vilareal.Core.Integrations.TribunalScraper.Models;
using Vilareal.Core.Integrations.TribunalScraper.Monitoring;

namespace Vilareal.Core.Integrations.TribunalScraper.Services.Strategies;

/// <summary>Família e-SAJ (HTML tabular). URLs e seletores vêm de <see cref="TribunalScraperEntry"/>.</summary>
public class EsajFamilyStrategy : BaseTribunalScraperStrategy
{
    private readonly LayoutChangeDetector _layoutDetector;

    public EsajFamilyStrategy(
        TribunalScraperEntry entry,
        ITribunalScraperClient client,
        IHtmlParsingService htmlParsing,
        IMemoryCache cache,
        ILogger logger,
        LayoutChangeDetector layoutDetector)
        : base(entry, client, htmlParsing, cache, logger)
    {
        _layoutDetector = layoutDetector;
    }

    public override async Task<IReadOnlyList<ProcessoScrapedDto>> SearchByLawyerAsync(
        string lawyerName,
        string oabNormalized,
        CancellationToken cancellationToken = default)
    {
        if (!Entry.Active)
            return Array.Empty<ProcessoScrapedDto>();

        var key = BuildCacheKey(lawyerName, oabNormalized);
        if (TryGetCache(key, out var cached) && cached != null)
            return cached;

        LogSearchStart(oabNormalized);

        var baseUri = new Uri(Entry.BaseUrl.EndsWith("/") ? Entry.BaseUrl : Entry.BaseUrl + "/");
        var rel = Entry.SearchEndpoint.TrimStart('/') + "?mock=oab&oab=" + Uri.EscapeDataString(oabNormalized);
        var target = new Uri(baseUri, rel);

        if (!await Client.ValidateRobotsAllowsPathAsync(baseUri, rel, cancellationToken).ConfigureAwait(false))
            Logger.LogWarning("robots.txt pode restringir o caminho {Path} em {Host}", rel, baseUri.Host);

        var html = await Client.GetAsync(TribunalCode, target, cancellationToken).ConfigureAwait(false);

        if (Entry.Selectors.TryGetValue("expectedRoot", out var expectedMarker))
        {
            var alert = await _layoutDetector.DetectChangeAsync(TribunalCode, html, expectedMarker, cancellationToken)
                .ConfigureAwait(false);
            if (alert != null)
                throw new LayoutChangeDetectedException(TribunalCode, expectedMarker, "(marcador ausente no HTML)");
        }

        if (html.Contains("esaj-empty", StringComparison.OrdinalIgnoreCase))
        {
            SaveCache(key, Array.Empty<ProcessoScrapedDto>());
            return Array.Empty<ProcessoScrapedDto>();
        }

        if (!Entry.Selectors.TryGetValue("row", out var rowSel))
            throw new TribunalScraperException("Config sem seletor 'row'.", TribunalCode);

        var cells = Entry.Selectors
            .Where(kv => kv.Key is not "row" and not "expectedRoot")
            .ToDictionary(kv => kv.Key, kv => kv.Value);

        var rows = await HtmlParsing.ParseHtmlRowsAsync(html, rowSel, cells, cancellationToken).ConfigureAwait(false);
        var list = new List<ProcessoScrapedDto>();
        foreach (var row in rows)
        {
            row.TryGetValue("processNumber", out var num);
            row.TryGetValue("classe", out var cls);
            row.TryGetValue("status", out var st);
            if (string.IsNullOrWhiteSpace(num))
                continue;
            var dto = new ProcessoScrapedDto
            {
                NumeroProcesso = num.Trim(),
                Tribunal = Entry.Code,
                Classe = cls?.Trim() ?? "",
                Status = st?.Trim() ?? "",
                DataExtracao = DateTime.UtcNow,
                Confianca = 0,
            };
            dto.Confianca = CalculateConfidence(dto);
            list.Add(dto);
        }

        SaveCache(key, list);
        return list;
    }
}
