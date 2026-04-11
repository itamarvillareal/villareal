using System.Text.RegularExpressions;
using Vilareal.Core.Integrations.TribunalScraper.Exceptions;

namespace Vilareal.Core.Integrations.TribunalScraper.Services;

/// <summary>Validação e normalização de inscrição OAB (heurística; seccionais podem ter regras adicionais).</summary>
public sealed class LawyerValidator
{
    private static readonly HashSet<string> UfsValidas = new(
        new[]
        {
            "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
            "RJ", "RN", "RS", "RO", "RR", "SC", "SE", "SP", "TO",
        },
        StringComparer.OrdinalIgnoreCase);

    /// <summary>Valida formato mínimo (UF conhecida + sequência numérica típica da OAB).</summary>
    public bool ValidateOabNumber(string oabNumber)
    {
        try
        {
            _ = NormalizeOabNumber(oabNumber);
            return true;
        }
        catch (InvalidOabNumberException)
        {
            return false;
        }
    }

    /// <summary>Normaliza para o padrão preferido <c>NNNNNN/UF</c> (sem prefixo OAB).</summary>
    /// <exception cref="InvalidOabNumberException">Quando não for possível extrair UF e número.</exception>
    public string NormalizeOabNumber(string oabNumber)
    {
        if (string.IsNullOrWhiteSpace(oabNumber))
            throw new InvalidOabNumberException(oabNumber ?? "", "vazio");

        var compact = Regex.Replace(oabNumber.Trim().ToUpperInvariant(), @"\s+", "");
        compact = Regex.Replace(compact, @"^OAB/", "", RegexOptions.IgnoreCase);

        // 123456/SP
        var m = Regex.Match(compact, @"^(?<n>\d{4,9})/(?<uf>[A-Z]{2})$");
        if (m.Success)
            return Finish(m.Groups["n"].Value, m.Groups["uf"].Value);

        // SP123456 ou SP/123456
        m = Regex.Match(compact, @"^(?<uf>[A-Z]{2})/?(?<n>\d{4,9})$");
        if (m.Success)
            return Finish(m.Groups["n"].Value, m.Groups["uf"].Value);

        throw new InvalidOabNumberException(oabNumber, "formato não reconhecido (use NNNNNN/UF ou UFNNNNNN).");
    }

    /// <summary>Extrai a UF da OAB já normalizada <c>NNNNNN/UF</c>.</summary>
    public string ExtractUfFromOab(string oabNumber)
    {
        var n = NormalizeOabNumber(oabNumber);
        var parts = n.Split('/');
        return parts.Length == 2 ? parts[1] : string.Empty;
    }

    private static string Finish(string digits, string uf)
    {
        if (!UfsValidas.Contains(uf))
            throw new InvalidOabNumberException($"{digits}/{uf}", "UF inválida.");
        if (digits.Length is < 4 or > 9)
            throw new InvalidOabNumberException($"{digits}/{uf}", "sequência numérica fora do intervalo esperado (4–9 dígitos).");
        return $"{digits}/{uf}";
    }
}
