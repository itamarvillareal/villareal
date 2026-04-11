using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Vilareal.Core.Integrations.TribunalScraper.Abstractions;
using Vilareal.Core.Integrations.TribunalScraper.Configuration;
using Vilareal.Core.Integrations.TribunalScraper.Exceptions;
using Vilareal.Core.Integrations.TribunalScraper.Monitoring;
using Vilareal.Core.Integrations.TribunalScraper.Services.Strategies;
using Vilareal.Infrastructure.Integrations.TribunalScraper;
using Xunit;

namespace Vilareal.Tests.Integrations.TribunalScraper;

public class TjspScraperStrategyTests
{
    private static string Fixture(string name) =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "TribunalScraper", "Fixtures", "html", name));

    private static TribunalScraperEntry LoadTjspEntry()
    {
        var path = Path.Combine(
            AppContext.BaseDirectory,
            "Integrations",
            "TribunalScraper",
            "Configuration",
            "tribunals-scraping-config.json");
        var root = JsonSerializer.Deserialize<TribunalScraperRootConfig>(
            File.ReadAllText(path),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        return root.Tribunals.First(t => t.Code == "TJSP");
    }

    [Fact]
    public async Task SearchByLawyerAsync_WithFixture_ReturnsProcesses()
    {
        var html = Fixture("tjsp-advogado-encontrado.html");
        var mockClient = new Mock<ITribunalScraperClient>();
        mockClient.Setup(c => c.ValidateRobotsAllowsPathAsync(It.IsAny<Uri>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        mockClient.Setup(c => c.GetAsync("TJSP", It.IsAny<Uri>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(html);

        var entry = LoadTjspEntry();
        var strategy = new TjspScraperStrategy(
            entry,
            mockClient.Object,
            new HtmlParsingService(NullLogger<HtmlParsingService>.Instance),
            new MemoryCache(new MemoryCacheOptions()),
            NullLogger<TjspScraperStrategy>.Instance,
            new LayoutChangeDetector());

        var list = await strategy.SearchByLawyerAsync("Fulano", "123456/SP");
        Assert.Equal(2, list.Count);
        Assert.Contains(list, p => p.NumeroProcesso.Contains("0000001-23"));
    }

    [Fact]
    public async Task SearchByLawyerAsync_Empty_ReturnsEmpty()
    {
        var html = Fixture("tjsp-advogado-nao-encontrado.html");
        var mockClient = new Mock<ITribunalScraperClient>();
        mockClient.Setup(c => c.ValidateRobotsAllowsPathAsync(It.IsAny<Uri>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        mockClient.Setup(c => c.GetAsync("TJSP", It.IsAny<Uri>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(html);

        var entry = LoadTjspEntry();
        var strategy = new TjspScraperStrategy(
            entry,
            mockClient.Object,
            new HtmlParsingService(NullLogger<HtmlParsingService>.Instance),
            new MemoryCache(new MemoryCacheOptions()),
            NullLogger<TjspScraperStrategy>.Instance,
            new LayoutChangeDetector());

        var list = await strategy.SearchByLawyerAsync("Ninguém", "111111/SP");
        Assert.Empty(list);
    }

    [Fact]
    public async Task SearchByLawyerAsync_LayoutChanged_Throws()
    {
        var html = Fixture("tjsp-layout-novo.html");
        var mockClient = new Mock<ITribunalScraperClient>();
        mockClient.Setup(c => c.ValidateRobotsAllowsPathAsync(It.IsAny<Uri>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        mockClient.Setup(c => c.GetAsync("TJSP", It.IsAny<Uri>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(html);

        var entry = LoadTjspEntry();
        var strategy = new TjspScraperStrategy(
            entry,
            mockClient.Object,
            new HtmlParsingService(NullLogger<HtmlParsingService>.Instance),
            new MemoryCache(new MemoryCacheOptions()),
            NullLogger<TjspScraperStrategy>.Instance,
            new LayoutChangeDetector());

        await Assert.ThrowsAsync<LayoutChangeDetectedException>(() =>
            strategy.SearchByLawyerAsync("Fulano", "123456/SP"));
    }
}
