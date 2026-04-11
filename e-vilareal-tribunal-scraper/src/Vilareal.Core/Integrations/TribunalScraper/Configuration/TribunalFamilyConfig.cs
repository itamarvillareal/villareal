using System.Text.Json.Serialization;

namespace Vilareal.Core.Integrations.TribunalScraper.Configuration;

public sealed class TribunalFamilyRootConfig
{
    [JsonPropertyName("families")]
    public List<TribunalFamilyEntry> Families { get; set; } = new();
}

public sealed class TribunalFamilyEntry
{
    public string Family { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string? BaseUrlPattern { get; set; }

    public Dictionary<string, string>? CommonSelectors { get; set; }

    public bool IsJsonApi { get; set; }
}
