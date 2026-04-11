using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Polly;
using Polly.Extensions.Http;
using Vilareal.Core.Integrations.TribunalScraper.Abstractions;
using Vilareal.Core.Integrations.TribunalScraper.Configuration;
using Vilareal.Core.Integrations.TribunalScraper.Monitoring;
using Vilareal.Core.Integrations.TribunalScraper.Services;

namespace Vilareal.Infrastructure.Integrations.TribunalScraper;

public static class TribunalScraperServiceCollectionExtensions
{
    /// <summary>Registra a LINHA 2 (scraping) isolada — chamar a partir do host Blazor (<c>Program.cs</c>).</summary>
    public static IServiceCollection AddVilarealTribunalScraper(this IServiceCollection services)
    {
        var path = Path.Combine(
            AppContext.BaseDirectory,
            "Integrations",
            "TribunalScraper",
            "Configuration",
            "tribunals-scraping-config.json");
        var json = File.ReadAllText(path);
        var root = JsonSerializer.Deserialize<TribunalScraperRootConfig>(
                       json,
                       new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                   ?? new TribunalScraperRootConfig();
        services.AddSingleton(Options.Create(root));

        services.AddLogging();
        services.AddMemoryCache();
        services.AddSingleton<LayoutChangeDetector>();
        services.AddScoped<LawyerValidator>();
        services.AddScoped<ITribunalScraperFactory, TribunalScraperFactory>();
        services.AddScoped<ITribunalScraperService, TribunalScraperService>();
        services.AddScoped<TribunalHealthMonitor>();
        services.AddScoped<IHtmlParsingService, HtmlParsingService>();
        services.AddScoped<IPuppeteerService, PuppeteerStubService>();

        services.AddHttpClient<ITribunalScraperClient, TribunalScraperClient>(client =>
                {
                    client.Timeout = TimeSpan.FromSeconds(30);
                })
            .AddPolicyHandler(HttpPolicyExtensions
                .HandleTransientHttpError()
                .WaitAndRetryAsync(3, retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt))));

        return services;
    }
}
