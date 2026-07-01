package br.com.vilareal.pessoa.application;

/** Dígitos normalizados e sufixo local (8) para indexação e busca de telefone. */
public final class TelefoneIndiceUtil {

    private static final int MAX_DIGITOS = 20;

    private TelefoneIndiceUtil() {}

    public record TelefoneIndice(String digitos, String sufixo8) {}

    public static TelefoneIndice fromRaw(String raw) {
        if (raw == null || raw.isBlank()) {
            return new TelefoneIndice(null, null);
        }
        String digits = raw.replaceAll("\\D", "");
        if (digits.isEmpty()) {
            return new TelefoneIndice(null, null);
        }
        if (digits.length() > MAX_DIGITOS) {
            digits = digits.substring(digits.length() - MAX_DIGITOS);
        }
        String sufixo8 = digits.length() >= 8 ? digits.substring(digits.length() - 8) : null;
        return new TelefoneIndice(digits, sufixo8);
    }
}
