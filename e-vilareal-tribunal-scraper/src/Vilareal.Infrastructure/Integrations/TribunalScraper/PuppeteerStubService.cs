using Microsoft.Extensions.Logging;
using Vilareal.Core.Integrations.TribunalScraper.Abstractions;

namespace Vilareal.Infrastructure.Integrations.TribunalScraper;

/// <summary>Stub até referência PuppeteerSharp ser aprovada no pipeline (headless pesado em CI).</summary>
public sealed class PuppeteerStubService : IPuppeteerService
{
    private readonly ILogger<PuppeteerStubService> _logger;

    public PuppeteerStubService(ILogger<PuppeteerStubService> logger) => _logger = logger;

    public Task<string> GetPageContentAsync(Uri url, int timeoutMs, CancellationToken cancellationToken = default)
    {
        _logger.LogWarning("PuppeteerStubService: headless desligado. URL={Url}", url);
        return Task.FromResult(string.Empty);
    }

    public Task<string> SearchByLawyerAsync(Uri baseUrl, string lawyerName, string oabNumber, int timeoutMs, CancellationToken cancellationToken = default)
    {
        _logger.LogWarning("PuppeteerStubService: busca headless não implementada.");
        return Task.FromResult(string.Empty);
    }

    public Task<bool> IsJavaScriptHeavyAsync(Uri url, CancellationToken cancellationToken = default) =>
        Task.FromResult(false);
}
