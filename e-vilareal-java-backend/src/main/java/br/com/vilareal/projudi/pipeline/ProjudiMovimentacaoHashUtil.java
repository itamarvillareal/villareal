package br.com.vilareal.projudi.pipeline;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Hash de deduplicação de movimentações PROJUDI ({@code hash_conteudo} em {@code publicacoes}).
 */
public final class ProjudiMovimentacaoHashUtil {

    private ProjudiMovimentacaoHashUtil() {}

    /**
     * {@code sha256Hex(somenteDigitos(numeroCnj) + "|" + idMovi)} — mesma regra do orquestrador legado.
     */
    public static String hashConteudoMovimentacao(String numeroCnj, String idMovi) {
        return sha256Hex(somenteDigitos(numeroCnj) + "|" + idMovi);
    }

    /** SHA-256 hex UTF-8 (ex.: {@code hash_teor} na gravação de publicação PROJUDI). */
    public static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest((input == null ? "" : input).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String somenteDigitos(String s) {
        if (s == null) {
            return "";
        }
        return s.replaceAll("\\D", "");
    }
}
