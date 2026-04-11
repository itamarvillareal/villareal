namespace Vilareal.Core.Integrations.TribunalScraper.Models;

public sealed class SyncHistoryRecord
{
    public DateTime UtcStarted { get; set; }

    public DateTime? UtcEnded { get; set; }

    public string TribunalCode { get; set; } = string.Empty;

    public string Operation { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public int RecordsImported { get; set; }

    public string? ErrorSummary { get; set; }
}
