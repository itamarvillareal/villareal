using System.Collections.Concurrent;
using System.Net.Http.Headers;
using Microsoft.Extensions.Logging;
using Vilareal.Core.Integrations.TribunalScraper.Abstractions;

namespace Vilareal.Infrastructure.Integrations.TribunalScraper;

/// <summary>Cliente HTTP com rate limit por tribunal, UA rotativo e leitura básica de robots.txt.</summary>
public sealed class TribunalScraperClient : ITribunalScraperClient
{
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> Locks = new(StringComparer.OrdinalIgnoreCase);
    private static readonly ConcurrentDictionary<string, long> LastRequestTicks = new(StringComparer.OrdinalIgnoreCase);

    private static readonly string[] UserAgents =
    {
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    };

    private readonly HttpClient _http;
    private readonly ILogger<TribunalScraperClient> _logger;
    private readonly Random _random = new();

    public TribunalScraperClient(HttpClient http, ILogger<TribunalScraperClient> logger)
    {
        _http = http;
        _logger = logger;
        if (_http.Timeout == TimeSpan.FromSeconds(100)) // default
            _http.Timeout = TimeSpan.FromSeconds(30);
    }

    public async Task<string> GetAsync(string tribunalCode, Uri uri, CancellationToken cancellationToken = default)
    {
        await ThrottleAsync(tribunalCode, 1_000, cancellationToken).ConfigureAwait(false);
        using var req = new HttpRequestMessage(HttpMethod.Get, uri);
        ApplyHeaders(req);
        using var res = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cancellationToken)
            .ConfigureAwait(false);
        res.EnsureSuccessStatusCode();
        return await res.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<string> PostAsync(string tribunalCode, Uri uri, HttpContent content, CancellationToken cancellationToken = default)
    {
        await ThrottleAsync(tribunalCode, 1_000, cancellationToken).ConfigureAwait(false);
        using var req = new HttpRequestMessage(HttpMethod.Post, uri) { Content = content };
        ApplyHeaders(req);
        using var res = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cancellationToken)
            .ConfigureAwait(false);
        res.EnsureSuccessStatusCode();
        return await res.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
    }

    public async Task<bool> ValidateRobotsAllowsPathAsync(Uri baseUri, string relativePath, CancellationToken cancellationToken = default)
    {
        try
        {
            var robots = new Uri(baseUri, "/robots.txt");
            await ThrottleAsync("_robots_", 2_000, cancellationToken).ConfigureAwait(false);
            using var req = new HttpRequestMessage(HttpMethod.Get, robots);
            ApplyHeaders(req);
            using var res = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cancellationToken)
                .ConfigureAwait(false);
            if (res.StatusCode == System.Net.HttpStatusCode.NotFound)
                return true;
            res.EnsureSuccessStatusCode();
            var body = await res.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            return !RobotsDisallows(body, relativePath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "robots.txt não interpretado para {Host} — assumindo permitido com cautela.", baseUri.Host);
            return true;
        }
    }

    private void ApplyHeaders(HttpRequestMessage req)
    {
        req.Headers.UserAgent.Clear();
        req.Headers.TryAddWithoutValidation("User-Agent", UserAgents[_random.Next(UserAgents.Length)]);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("*/*"));
        req.Headers.TryAddWithoutValidation("Accept-Language", "pt-BR,pt;q=0.9");
    }

    private static async Task ThrottleAsync(string tribunalCode, int minIntervalMs, CancellationToken ct)
    {
        var gate = Locks.GetOrAdd(tribunalCode, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            if (LastRequestTicks.TryGetValue(tribunalCode, out var last))
            {
                var elapsed = (DateTime.UtcNow.Ticks - last) / TimeSpan.TicksPerMillisecond;
                if (elapsed < minIntervalMs)
                    await Task.Delay((int)(minIntervalMs - elapsed), ct).ConfigureAwait(false);
            }

            LastRequestTicks[tribunalCode] = DateTime.UtcNow.Ticks;
        }
        finally
        {
            gate.Release();
        }
    }

    private static bool RobotsDisallows(string robotsTxt, string relativePath)
    {
        var path = relativePath.StartsWith('/') ? relativePath : "/" + relativePath;
        using var reader = new StringReader(robotsTxt);
        var applies = false;
        while (reader.ReadLine() is { } line)
        {
            var t = line.Trim();
            if (t.StartsWith("User-agent:", StringComparison.OrdinalIgnoreCase))
            {
                var ua = t.Substring("User-agent:".Length).Trim();
                applies = ua == "*" || ua.Contains("Vilareal", StringComparison.OrdinalIgnoreCase);
            }

            if (!applies)
                continue;
            if (t.StartsWith("Disallow:", StringComparison.OrdinalIgnoreCase))
            {
                var rule = t.Substring("Disallow:".Length).Trim();
                if (string.IsNullOrEmpty(rule))
                    continue;
                if (path.StartsWith(rule, StringComparison.OrdinalIgnoreCase))
                    return true;
            }
        }

        return false;
    }
}
