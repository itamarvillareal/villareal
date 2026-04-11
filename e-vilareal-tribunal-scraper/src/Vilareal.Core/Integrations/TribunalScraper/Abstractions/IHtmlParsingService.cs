using System.Text.Json;

namespace Vilareal.Core.Integrations.TribunalScraper.Abstractions;

/// <summary>Parsing HTML/JSON para estratégias de scraping.</summary>
public interface IHtmlParsingService
{
    Task<IReadOnlyDictionary<string, string>> ParseHtmlAsync(string html, IReadOnlyDictionary<string, string> selectors, CancellationToken cancellationToken = default);

    Task<JsonDocument?> ParseJsonAsync(string json, CancellationToken cancellationToken = default);

    /// <summary>Retorna true se nenhum dos seletores obrigatórios encontrou nó no HTML.</summary>
    Task<bool> DetectLayoutChangeAsync(string html, IReadOnlyList<string> expectedSelectors, CancellationToken cancellationToken = default);

    Task<string?> TryAlternativeSelectorsAsync(string html, IReadOnlyList<string> selectors, CancellationToken cancellationToken = default);

    /// <summary>
    /// Extrai várias linhas (ex.: linhas de tabela de resultados). Seletores de célula são relativos a cada linha (XPath ou classe simples).
    /// </summary>
    Task<IReadOnlyList<IReadOnlyDictionary<string, string>>> ParseHtmlRowsAsync(
        string html,
        string rowSelector,
        IReadOnlyDictionary<string, string> cellSelectorsRelativeToRow,
        CancellationToken cancellationToken = default);
}
