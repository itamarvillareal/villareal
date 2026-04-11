using System.Text.Json;
using HtmlAgilityPack;
using Microsoft.Extensions.Logging;
using Vilareal.Core.Integrations.TribunalScraper.Abstractions;

namespace Vilareal.Infrastructure.Integrations.TribunalScraper;

public sealed class HtmlParsingService : IHtmlParsingService
{
    private readonly ILogger<HtmlParsingService> _logger;

    public HtmlParsingService(ILogger<HtmlParsingService> logger) => _logger = logger;

    public Task<IReadOnlyDictionary<string, string>> ParseHtmlAsync(
        string html,
        IReadOnlyDictionary<string, string> selectors,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var doc = new HtmlDocument();
        doc.LoadHtml(html);
        var dict = new Dictionary<string, string>();
        foreach (var kv in selectors)
        {
            var node = doc.DocumentNode.SelectSingleNode(ToXPath(kv.Value));
            dict[kv.Key] = node?.InnerText?.Trim() ?? string.Empty;
        }

        return Task.FromResult<IReadOnlyDictionary<string, string>>(dict);
    }

    public Task<JsonDocument?> ParseJsonAsync(string json, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        try
        {
            return Task.FromResult<JsonDocument?>(JsonDocument.Parse(json));
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "JSON inválido recebido no parsing.");
            return Task.FromResult<JsonDocument?>(null);
        }
    }

    public Task<bool> DetectLayoutChangeAsync(
        string html,
        IReadOnlyList<string> expectedSelectors,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var doc = new HtmlDocument();
        doc.LoadHtml(html);
        foreach (var sel in expectedSelectors)
        {
            if (string.IsNullOrWhiteSpace(sel))
                continue;
            var node = doc.DocumentNode.SelectSingleNode(ToXPath(sel));
            if (node == null)
                return Task.FromResult(true);
        }

        return Task.FromResult(false);
    }

    public Task<string?> TryAlternativeSelectorsAsync(
        string html,
        IReadOnlyList<string> selectors,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var doc = new HtmlDocument();
        doc.LoadHtml(html);
        foreach (var sel in selectors)
        {
            var node = doc.DocumentNode.SelectSingleNode(ToXPath(sel));
            if (node != null)
                return Task.FromResult<string?>(node.InnerText?.Trim());
        }

        return Task.FromResult<string?>(null);
    }

    public Task<IReadOnlyList<IReadOnlyDictionary<string, string>>> ParseHtmlRowsAsync(
        string html,
        string rowSelector,
        IReadOnlyDictionary<string, string> cellSelectorsRelativeToRow,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var doc = new HtmlDocument();
        doc.LoadHtml(html);
        var rowXPath = ToXPath(rowSelector);
        var rows = doc.DocumentNode.SelectNodes(rowXPath);
        var list = new List<IReadOnlyDictionary<string, string>>();
        if (rows == null)
            return Task.FromResult<IReadOnlyList<IReadOnlyDictionary<string, string>>>(list);
        foreach (var row in rows)
        {
            var rowDict = new Dictionary<string, string>();
            foreach (var kv in cellSelectorsRelativeToRow)
            {
                var rel = kv.Value.StartsWith("//", StringComparison.Ordinal) ? kv.Value : "." + kv.Value;
                var cell = row.SelectSingleNode(rel);
                rowDict[kv.Key] = cell?.InnerText?.Trim() ?? string.Empty;
            }

            list.Add(rowDict);
        }

        return Task.FromResult<IReadOnlyList<IReadOnlyDictionary<string, string>>>(list);
    }

    /// <summary>Permite XPath direto ou seletor curto ".classe" / "#id".</summary>
    private static string ToXPath(string selector)
    {
        var s = selector.Trim();
        if (s.StartsWith("//", StringComparison.Ordinal) || s.StartsWith("(/", StringComparison.Ordinal))
            return s;
        if (s.StartsWith('.'))
        {
            var cls = s.TrimStart('.').Split(' ').FirstOrDefault() ?? "";
            return $"//*[contains(concat(' ', normalize-space(@class), ' '), ' {cls} ')]";
        }

        if (s.StartsWith('#'))
        {
            var id = s.TrimStart('#');
            return $"//*[@id='{id}']";
        }

        return s;
    }
}
