namespace Vilareal.Core.Integrations.TribunalScraper.Models;

public sealed class MovimentacaoScrapedDto
{
    public DateTime Data { get; set; }

    public string Tipo { get; set; } = string.Empty;

    public string Descricao { get; set; } = string.Empty;

    public string Orgao { get; set; } = string.Empty;

    public DateTime ExtraidoEm { get; set; } = DateTime.UtcNow;
}
