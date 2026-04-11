namespace Vilareal.Core.Integrations.TribunalScraper.Abstractions;

/// <summary>
/// Cliente HTTP para integrações de scraping de tribunais (rate limit, retry, robots).
/// </summary>
public interface ITribunalScraperClient
{
    /// <summary>Obtém o corpo da resposta como string (texto/HTML).</summary>
    Task<string> GetAsync(string tribunalCode, Uri uri, CancellationToken cancellationToken = default);

    /// <summary>POST com corpo (ex.: application/x-www-form-urlencoded ou JSON).</summary>
    Task<string> PostAsync(
        string tribunalCode,
        Uri uri,
        HttpContent content,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Verifica se o caminho relativo costuma ser permitido pelo robots.txt do host (heurística; não substitui análise jurídica).
    /// </summary>
    Task<bool> ValidateRobotsAllowsPathAsync(Uri baseUri, string relativePath, CancellationToken cancellationToken = default);
}
