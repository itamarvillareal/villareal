namespace Vilareal.Core.Integrations.TribunalScraper.Models;

public sealed class PublicacaoScrapedDto
{
    public DateTime Data { get; set; }

    public string Tribunal { get; set; } = string.Empty;

    public string Conteudo { get; set; } = string.Empty;

    public string Tipo { get; set; } = string.Empty;

    public string UrlOrigem { get; set; } = string.Empty;
}
