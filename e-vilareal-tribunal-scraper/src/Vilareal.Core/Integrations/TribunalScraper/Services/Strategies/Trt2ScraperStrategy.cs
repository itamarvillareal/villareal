using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Vilareal.Core.Integrations.TribunalScraper.Abstractions;
using Vilareal.Core.Integrations.TribunalScraper.Configuration;

namespace Vilareal.Core.Integrations.TribunalScraper.Services.Strategies;

public sealed class Trt2ScraperStrategy : PjeFamilyStrategy
{
    public Trt2ScraperStrategy(
        TribunalScraperEntry entry,
        ITribunalScraperClient client,
        IHtmlParsingService htmlParsing,
        IMemoryCache cache,
        ILogger<Trt2ScraperStrategy> logger)
        : base(entry, client, htmlParsing, cache, logger)
    {
    }
}
