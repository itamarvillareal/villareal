using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Vilareal.Core.Integrations.TribunalScraper.Abstractions;
using Vilareal.Core.Integrations.TribunalScraper.Configuration;
using Vilareal.Core.Integrations.TribunalScraper.Monitoring;

namespace Vilareal.Core.Integrations.TribunalScraper.Services.Strategies;

/// <summary>TJSP via família e-SAJ (comportamento específico pode ser acrescentado aqui).</summary>
public sealed class TjspScraperStrategy : EsajFamilyStrategy
{
    public TjspScraperStrategy(
        TribunalScraperEntry entry,
        ITribunalScraperClient client,
        IHtmlParsingService htmlParsing,
        IMemoryCache cache,
        ILogger<TjspScraperStrategy> logger,
        LayoutChangeDetector layoutDetector)
        : base(entry, client, htmlParsing, cache, logger, layoutDetector)
    {
    }
}
