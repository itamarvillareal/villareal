using Vilareal.Core.Integrations.TribunalScraper.Models;

namespace Vilareal.Core.Integrations.TribunalScraper.Abstractions;

/// <summary>Estratégia de extração por tribunal ou família de sistema (PJe, e-SAJ, etc.).</summary>
public interface ITribunalScraperStrategy
{
    string TribunalCode { get; }

    Task<IReadOnlyList<ProcessoScrapedDto>> SearchByLawyerAsync(string lawyerName, string oabNormalized, CancellationToken cancellationToken = default);
}
