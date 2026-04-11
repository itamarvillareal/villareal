using Vilareal.Core.Integrations.TribunalScraper.Monitoring;
using Xunit;

namespace Vilareal.Tests.Integrations.TribunalScraper;

public class LayoutChangeDetectorTests
{
    private readonly LayoutChangeDetector _detector = new();

    [Fact]
    public async Task DetectChangeAsync_MarkerMissing_ReturnsAlert()
    {
        var html = "<html><body>sem tabela</body></html>";
        var alert = await _detector.DetectChangeAsync("TJSP", html, "tblResult");
        Assert.NotNull(alert);
        Assert.Equal("TJSP", alert!.Tribunal);
    }

    [Fact]
    public async Task DetectChangeAsync_MarkerPresent_ReturnsNull()
    {
        var html = "<html><body><table id='tblResult'></table></body></html>";
        var alert = await _detector.DetectChangeAsync("TJSP", html, "tblResult");
        Assert.Null(alert);
    }

    [Fact]
    public async Task GetHistoryAsync_AfterDetection_ReturnsHistory()
    {
        await _detector.DetectChangeAsync("TJMG", "<html/>", "missing");
        var h = await _detector.GetHistoryAsync("TJMG");
        Assert.NotEmpty(h);
    }
}
