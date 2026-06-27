package br.com.vilareal.common.text;

import java.util.regex.Pattern;

/**
 * Reverte corrupção em que «é» virou «são» no meio de palavras (ex.: prévio → prsãovio, Félix → Fsãolix).
 *
 * <p>Causa típica: {@code \\b} ASCII em {@code LocacaoConcordanciaReuUtil} flexionava «é» dentro de palavras
 * acentuadas para «são» com locatários no plural.
 */
public final class EAgudoCorrompidoCorrecaoUtil {

    private static final Pattern E_AGUDO_CORROMPIDO_SAO =
            Pattern.compile("(?<=[\\p{L}])são(?=[\\p{L}])", Pattern.UNICODE_CASE | Pattern.UNICODE_CHARACTER_CLASS);

    private EAgudoCorrompidoCorrecaoUtil() {}

    public static String corrigir(String texto) {
        if (texto == null || texto.isEmpty() || !texto.contains("sã")) {
            return texto;
        }
        return E_AGUDO_CORROMPIDO_SAO.matcher(texto).replaceAll("é");
    }
}
