using System.Text.Json.Serialization;

namespace Vilareal.Core.Integrations.TribunalScraper.Configuration;

/// <summary>Raiz do arquivo tribunals-scraping-config.json.</summary>
public sealed class TribunalScraperRootConfig
{
    [JsonPropertyName("tribunals")]
    public List<TribunalScraperEntry> Tribunals { get; set; } = new();
}

/// <summary>Configuração de um tribunal (MVP: TJSP, TRT2, TSE).</summary>
public sealed class TribunalScraperEntry
{
    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Sphere { get; set; } = string.Empty;

    /// <summary>PJE | ESAJ | CUSTOM</summary>
    public string Family { get; set; } = string.Empty;

    public string BaseUrl { get; set; } = string.Empty;

    public string SearchEndpoint { get; set; } = string.Empty;

    public Dictionary<string, string> Selectors { get; set; } = new();

    public Dictionary<string, List<string>>? AlternativeSelectors { get; set; }

    public int TimeoutMs { get; set; } = 30_000;

    public string RetryPolicy { get; set; } = "exponential";

    public int RateLimitMs { get; set; } = 1_000;

    public bool Active { get; set; } = true;

    public string? LastUpdate { get; set; }

    public string? Notes { get; set; }
}
