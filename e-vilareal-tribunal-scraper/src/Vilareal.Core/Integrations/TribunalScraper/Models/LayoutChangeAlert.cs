namespace Vilareal.Core.Integrations.TribunalScraper.Models;

public sealed class LayoutChangeAlert
{
    public string Tribunal { get; set; } = string.Empty;

    public DateTime DataDeteccao { get; set; } = DateTime.UtcNow;

    public string SeletorAnterior { get; set; } = string.Empty;

    public string SeletorNovo { get; set; } = string.Empty;

    /// <summary>detected | fixed | pending</summary>
    public string Status { get; set; } = "detected";
}
