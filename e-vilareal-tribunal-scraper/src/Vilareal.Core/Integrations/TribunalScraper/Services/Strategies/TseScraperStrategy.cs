using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Vilareal.Core.Integrations.TribunalScraper.Abstractions;
using Vilareal.Core.Integrations.TribunalScraper.Configuration;

namespace Vilareal.Core.Integrations.TribunalScraper.Services.Strategies;

public sealed class TseScraperStrategy : PjeFamilyStrategy
{
    public TseScraperStrategy(
        TribunalScraperEntry entry,
        ITribunalScraperClient client,
        IHtmlParsingService htmlParsing,
        IMemoryCache cache,
        ILogger<TseScraperStrategy> logger)
        : base(entry, client, htmlParsing, cache, logger)
    {
    }
}
