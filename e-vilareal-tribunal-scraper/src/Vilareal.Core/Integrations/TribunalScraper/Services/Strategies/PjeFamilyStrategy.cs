using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Vilareal.Core.Integrations.TribunalScraper.Abstractions;
using Vilareal.Core.Integrations.TribunalScraper.Configuration;
using Vilareal.Core.Integrations.TribunalScraper.Models;

namespace Vilareal.Core.Integrations.TribunalScraper.Services.Strategies;

/// <summary>Família PJe: prioriza JSON de API interna quando o payload for JSON; senão HTML tabular.</summary>
public class PjeFamilyStrategy : BaseTribunalScraperStrategy
{
    public PjeFamilyStrategy(
        TribunalScraperEntry entry,
        ITribunalScraperClient client,
        IHtmlParsingService htmlParsing,
        IMemoryCache cache,
        ILogger logger)
        : base(entry, client, htmlParsing, cache, logger)
    {
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

        var body = await Client.GetAsync(TribunalCode, target, cancellationToken).ConfigureAwait(false);
        var trimmed = body.TrimStart();
        if (trimmed.StartsWith('{') || trimmed.StartsWith('['))
        {
            using var doc = await HtmlParsing.ParseJsonAsync(body, cancellationToken).ConfigureAwait(false);
            var list = ParsePjeJson(doc);
            SaveCache(key, list);
            return list;
        }

        if (!Entry.Selectors.TryGetValue("row", out var rowSel))
            return Array.Empty<ProcessoScrapedDto>();

        var cells = Entry.Selectors
            .Where(kv => kv.Key is not "row" and not "expectedRoot")
            .ToDictionary(kv => kv.Key, kv => kv.Value);

        var rows = await HtmlParsing.ParseHtmlRowsAsync(body, rowSel, cells, cancellationToken).ConfigureAwait(false);
        var htmlList = new List<ProcessoScrapedDto>();
        foreach (var row in rows)
        {
            row.TryGetValue("processNumber", out var num);
            row.TryGetValue("classe", out var cls);
            if (string.IsNullOrWhiteSpace(num))
                continue;
            var dto = new ProcessoScrapedDto
            {
                NumeroProcesso = num.Trim(),
                Tribunal = Entry.Code,
                Classe = cls?.Trim() ?? "",
                DataExtracao = DateTime.UtcNow,
            };
            dto.Confianca = CalculateConfidence(dto);
            htmlList.Add(dto);
        }

        SaveCache(key, htmlList);
        return htmlList;
    }

    private List<ProcessoScrapedDto> ParsePjeJson(JsonDocument? doc)
    {
        var list = new List<ProcessoScrapedDto>();
        if (doc == null)
            return list;

        if (!doc.RootElement.TryGetProperty("items", out var items) || items.ValueKind != JsonValueKind.Array)
            return list;

        foreach (var el in items.EnumerateArray())
        {
            var num = el.TryGetProperty("numeroProcesso", out var n) ? n.GetString() ?? "" : "";
            if (string.IsNullOrWhiteSpace(num))
                continue;
            var cls = el.TryGetProperty("classe", out var c) ? c.GetString() ?? "" : "";
            var dto = new ProcessoScrapedDto
            {
                NumeroProcesso = num,
                Tribunal = Entry.Code,
                Classe = cls,
                DataExtracao = DateTime.UtcNow,
            };
            dto.Confianca = CalculateConfidence(dto);
            list.Add(dto);
        }

        return list;
    }
}
