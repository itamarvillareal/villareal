using Vilareal.Core.Integrations.TribunalScraper.Configuration;

namespace Vilareal.Core.Integrations.TribunalScraper.Abstractions;

/// <summary>Fábrica de estratégias com base na configuração por tribunal.</summary>
public interface ITribunalScraperFactory
{
    ITribunalScraperStrategy CreateScraper(string tribunalCode);

    IReadOnlyList<TribunalScraperEntry> GetAvailableTribunals();
}
