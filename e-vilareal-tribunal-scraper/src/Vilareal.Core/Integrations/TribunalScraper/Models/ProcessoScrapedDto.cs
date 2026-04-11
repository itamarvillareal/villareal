namespace Vilareal.Core.Integrations.TribunalScraper.Models;

/// <summary>Processo obtido via scraping ou família de sistema (metadados; confiança operacional).</summary>
public sealed class ProcessoScrapedDto
{
    public string NumeroProcesso { get; set; } = string.Empty;

    public string Tribunal { get; set; } = string.Empty;

    public string Classe { get; set; } = string.Empty;

    public List<string> Assuntos { get; set; } = new();

    public List<string> Partes { get; set; } = new();

    public DateTime? DataAjuizamento { get; set; }

    public string Status { get; set; } = string.Empty;

    public string Fonte { get; set; } = "scraping";

    public DateTime DataExtracao { get; set; } = DateTime.UtcNow;

    /// <summary>0–100; heurística local (preenchimento de campos, consistência CNJ).</summary>
    public int Confianca { get; set; }
}
