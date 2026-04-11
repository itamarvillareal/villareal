namespace Vilareal.Core.Integrations.TribunalScraper.Models;

/// <summary>Resultado de sincronização (linha isolada: sem escrita em NHibernate).</summary>
public sealed class SyncResult
{
    public bool Success { get; set; }

    public string Message { get; set; } = string.Empty;

    public string NumeroProcesso { get; set; } = string.Empty;

    public string TribunalCode { get; set; } = string.Empty;
}
