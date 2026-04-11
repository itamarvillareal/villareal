using Vilareal.Core.Integrations.TribunalScraper.Models;

namespace Vilareal.Core.Integrations.TribunalScraper.Monitoring;

/// <summary>
/// Detecção leve de mudança de layout via <i>marcador</i> estável no HTML (fragmento de id, classe ou texto).
/// Evita dependência de parser HTML no projeto Core.
/// </summary>
public sealed class LayoutChangeDetector
{
    private static readonly object Gate = new();
    private static readonly Dictionary<string, List<LayoutChangeAlert>> History = new(StringComparer.OrdinalIgnoreCase);

    public Task<LayoutChangeAlert?> DetectChangeAsync(
        string tribunalCode,
        string html,
        string? expectedMarker,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (string.IsNullOrWhiteSpace(expectedMarker))
            return Task.FromResult<LayoutChangeAlert?>(null);

        if (html.Contains(expectedMarker, StringComparison.Ordinal))
            return Task.FromResult<LayoutChangeAlert?>(null);

        var alert = new LayoutChangeAlert
        {
            Tribunal = tribunalCode,
            SeletorAnterior = expectedMarker,
            SeletorNovo = "(ausente)",
            Status = "detected",
        };

        lock (Gate)
        {
            if (!History.TryGetValue(tribunalCode, out var list))
            {
                list = new List<LayoutChangeAlert>();
                History[tribunalCode] = list;
            }

            list.Add(alert);
        }

        return Task.FromResult<LayoutChangeAlert?>(alert);
    }

    public Task<IReadOnlyList<LayoutChangeAlert>> GetHistoryAsync(string tribunalCode, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (Gate)
        {
            return Task.FromResult<IReadOnlyList<LayoutChangeAlert>>(
                History.TryGetValue(tribunalCode, out var list) ? list.ToList() : Array.Empty<LayoutChangeAlert>());
        }
    }
}
