using Microsoft.Extensions.Logging;

namespace Vilareal.Infrastructure.Integrations.TribunalScraper;

/// <summary>
/// Ponto único para convenções de <see cref="HttpClient"/> (timeout, headers) quando não se usa <c>AddHttpClient&lt;T&gt;</c>.
/// </summary>
public static class TribunalScraperHttpClientFactory
{
    public static HttpClient CreateDefault(ILogger? logger = null)
    {
        var client = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd(
            "VilarealTribunalScraper/1.0 (+https://example.invalid; contato interno)");
        logger?.LogDebug("HttpClient padrão do scraper criado.");
        return client;
    }
}
