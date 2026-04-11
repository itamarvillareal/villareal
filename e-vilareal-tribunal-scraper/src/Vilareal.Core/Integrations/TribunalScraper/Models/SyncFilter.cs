namespace Vilareal.Core.Integrations.TribunalScraper.Models;

public sealed class SyncFilter
{
    public string? TribunalCode { get; set; }

    public DateTime? SinceUtc { get; set; }
}
