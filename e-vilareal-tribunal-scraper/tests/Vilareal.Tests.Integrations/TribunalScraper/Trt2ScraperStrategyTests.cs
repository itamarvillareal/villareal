using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Vilareal.Core.Integrations.TribunalScraper.Abstractions;
using Vilareal.Core.Integrations.TribunalScraper.Configuration;
using Vilareal.Core.Integrations.TribunalScraper.Services.Strategies;
using Vilareal.Infrastructure.Integrations.TribunalScraper;
using Xunit;

namespace Vilareal.Tests.Integrations.TribunalScraper;

public class Trt2ScraperStrategyTests
{
    private static string Fixture(string name) =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "TribunalScraper", "Fixtures", "html", name));

    private static TribunalScraperEntry LoadTrt2()
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
        return root.Tribunals.First(t => t.Code == "TRT2");
    }

    [Fact]
    public async Task SearchByLawyerAsync_JsonFixture_ReturnsItems()
    {
        var body = Fixture("trt2-pje-advogado-encontrado.html");
        var mockClient = new Mock<ITribunalScraperClient>();
        mockClient.Setup(c => c.GetAsync("TRT2", It.IsAny<Uri>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(body);

        var entry = LoadTrt2();
        var strategy = new Trt2ScraperStrategy(
            entry,
            mockClient.Object,
            new HtmlParsingService(NullLogger<HtmlParsingService>.Instance),
            new MemoryCache(new MemoryCacheOptions()),
            NullLogger<Trt2ScraperStrategy>.Instance);

        var list = await strategy.SearchByLawyerAsync("Beltrano", "654321/RJ");
        Assert.Equal(2, list.Count);
        Assert.StartsWith("0001000", list[0].NumeroProcesso, StringComparison.Ordinal);
    }
}
