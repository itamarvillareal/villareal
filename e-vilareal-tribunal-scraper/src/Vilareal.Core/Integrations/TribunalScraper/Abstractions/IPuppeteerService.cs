namespace Vilareal.Core.Integrations.TribunalScraper.Abstractions;

/// <summary>
/// Fallback headless quando o conteúdo depende fortemente de JavaScript.
/// Implementação concreta pode usar PuppeteerSharp quando aprovado no pipeline de build (não obrigatório para compilar o núcleo).
/// </summary>
public interface IPuppeteerService
{
    Task<string> GetPageContentAsync(Uri url, int timeoutMs, CancellationToken cancellationToken = default);

    Task<string> SearchByLawyerAsync(Uri baseUrl, string lawyerName, string oabNumber, int timeoutMs, CancellationToken cancellationToken = default);

    Task<bool> IsJavaScriptHeavyAsync(Uri url, CancellationToken cancellationToken = default);
}
