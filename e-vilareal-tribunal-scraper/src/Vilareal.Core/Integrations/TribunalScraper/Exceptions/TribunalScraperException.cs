namespace Vilareal.Core.Integrations.TribunalScraper.Exceptions;

/// <summary>Erro genérico na linha de scraping de tribunais.</summary>
public class TribunalScraperException : Exception
{
    public string? Tribunal { get; }

    public DateTime TimestampUtc { get; } = DateTime.UtcNow;

    public TribunalScraperException(string message, string? tribunal = null, Exception? inner = null)
        : base(message, inner)
    {
        Tribunal = tribunal;
    }
}
