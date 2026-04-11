using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Vilareal.Core.Integrations.TribunalScraper.Abstractions;
using Vilareal.Core.Integrations.TribunalScraper.Exceptions;
using Vilareal.Core.Integrations.TribunalScraper.Models;
using Vilareal.Core.Integrations.TribunalScraper.Services;
using Xunit;

namespace Vilareal.Tests.Integrations.TribunalScraper;

public class TribunalScraperServiceTests
{
    [Fact]
    public async Task SearchByLawyerAsync_InvalidOab_PropagatesFromValidator()
    {
        var factory = new Mock<ITribunalScraperFactory>();
        var service = new TribunalScraperService(factory.Object, new LawyerValidator(), NullLogger<TribunalScraperService>.Instance);
        await Assert.ThrowsAsync<InvalidOabNumberException>(() => service.SearchByLawyerAsync(new LawyerSearchRequest
        {
            LawyerName = "X",
            OabNumber = "invalid",
            Spheres = new List<string>(),
        }));
    }

    [Fact]
    public async Task SyncProcessAsync_IsolatedLine_ReturnsNotPersisted()
    {
        var factory = new Mock<ITribunalScraperFactory>();
        var service = new TribunalScraperService(factory.Object, new LawyerValidator(), NullLogger<TribunalScraperService>.Instance);
        var r = await service.SyncProcessAsync("0000000-00.0000.0.00.0000", "TJSP");
        Assert.False(r.Success);
        Assert.Contains("isolada", r.Message, StringComparison.OrdinalIgnoreCase);
    }
}
