namespace Vilareal.Core.Integrations.TribunalScraper.Models;

/// <summary>Parâmetros de busca por advogado (OAB + nome auxiliar).</summary>
public sealed class LawyerSearchRequest
{
    public string LawyerName { get; set; } = string.Empty;

    /// <summary>Número OAB bruto ou normalizado (ex.: 123456/SP).</summary>
    public string OabNumber { get; set; } = string.Empty;

    /// <summary>Esferas desejadas: estadual, federal, trabalhista, eleitoral, militar.</summary>
    public List<string> Spheres { get; set; } = new();
}
