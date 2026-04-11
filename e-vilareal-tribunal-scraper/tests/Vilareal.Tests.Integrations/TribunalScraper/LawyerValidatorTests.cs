using System.Text.Json;
using Vilareal.Core.Integrations.TribunalScraper.Exceptions;
using Vilareal.Core.Integrations.TribunalScraper.Services;
using Xunit;

namespace Vilareal.Tests.Integrations.TribunalScraper;

public class LawyerValidatorTests
{
    private readonly LawyerValidator _v = new();

    [Theory]
    [InlineData("123456/SP", "123456/SP")]
    [InlineData("  123456/sp  ", "123456/SP")]
    [InlineData("SP123456", "123456/SP")]
    [InlineData("OAB/SP987654", "987654/SP")]
    public void NormalizeOabNumber_ValidFormat_ReturnsExpected(string raw, string expected)
    {
        Assert.Equal(expected, _v.NormalizeOabNumber(raw));
    }

    [Theory]
    [InlineData("123456/SP")]
    [InlineData("RJ987654")]
    public void ValidateOabNumber_Valid_ReturnsTrue(string raw) =>
        Assert.True(_v.ValidateOabNumber(raw));

    [Theory]
    [InlineData("")]
    [InlineData("123/XX")]
    [InlineData("abc/SP")]
    public void ValidateOabNumber_Invalid_ReturnsFalse(string raw) =>
        Assert.False(_v.ValidateOabNumber(raw));

    [Fact]
    public void ExtractUfFromOab_ValidOab_ReturnsUf() =>
        Assert.Equal("SP", _v.ExtractUfFromOab("123456/SP"));

    [Fact]
    public void NormalizeOabNumber_FromFixtureJson_ValidCases()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "TribunalScraper", "Fixtures", "oab-numbers.json");
        var json = File.ReadAllText(path);
        using var doc = JsonDocument.Parse(json);
        foreach (var el in doc.RootElement.GetProperty("valid").EnumerateArray())
        {
            var raw = el.GetProperty("raw").GetString()!;
            var expected = el.GetProperty("normalized").GetString()!;
            Assert.Equal(expected, _v.NormalizeOabNumber(raw));
        }
    }

    [Fact]
    public void NormalizeOabNumber_InvalidFromFixture_Throws()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "TribunalScraper", "Fixtures", "oab-numbers.json");
        var json = File.ReadAllText(path);
        using var doc = JsonDocument.Parse(json);
        foreach (var el in doc.RootElement.GetProperty("invalid").EnumerateArray())
        {
            var raw = el.GetProperty("raw").GetString()!;
            Assert.Throws<InvalidOabNumberException>(() => _v.NormalizeOabNumber(raw));
        }
    }
}
