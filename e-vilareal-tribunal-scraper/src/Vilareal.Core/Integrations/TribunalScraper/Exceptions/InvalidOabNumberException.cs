namespace Vilareal.Core.Integrations.TribunalScraper.Exceptions;

public sealed class InvalidOabNumberException : TribunalScraperException
{
    public string OabNumber { get; }

    public string Motivo { get; }

    public InvalidOabNumberException(string oabNumber, string motivo)
        : base($"OAB inválida: {motivo}", null)
    {
        OabNumber = oabNumber;
        Motivo = motivo;
    }
}
