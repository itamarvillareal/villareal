namespace Vilareal.Core.Integrations.TribunalScraper.Models;

public sealed class ScraperHealthCheck
{
    public string Tribunal { get; set; } = string.Empty;

    public DateTime UltimaExecucao { get; set; }

    /// <summary>green | yellow | red</summary>
    public string Status { get; set; } = "green";

    public decimal TaxaSucesso { get; set; }

    public string UltimoErro { get; set; } = string.Empty;
}
