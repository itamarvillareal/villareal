package br.com.vilareal.common.text;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;

/**
 * Corrige texto em que sequências UTF-8 válidas foram interpretadas como ISO-8859-1/Latin-1
 * (cada byte virou um caractere Unicode &lt;= U+00FF), gerando padrões como "Ã©" no lugar de "é".
 *
 * <p>Também trata <strong>dupla</strong> (ou mais) codificação: texto Latin-1 errado foi gravado de
 * novo em UTF-8, aparecendo como "├é┬¬", "├âÔÇí", etc.
 *
 * <p>Na reversão dupla, tenta <strong>ISO-8859-1</strong> e <strong>Windows-1252</strong> ao ler os
 * bytes UTF-8 atuais (importações Excel/Windows costumam usar CP1252).
 */
public final class Utf8MojibakeUtil {

    private static final int MAX_PASSES_LATIN1_UTF8 = 6;
    private static final int MAX_PASSES_DUPLA = 10;
    private static final Charset WINDOWS_1252 = Charset.forName("Windows-1252");

    private Utf8MojibakeUtil() {}

    public static String corrigir(String s) {
        if (s == null || s.isEmpty()) {
            return s;
        }
        String cur = s;
        if (deveTentarReverterDuplaCamada(cur)) {
            for (int k = 0; k < MAX_PASSES_DUPLA; k++) {
                // Não interromper só porque o texto corrompido cabe em Latin-1: mojibake típico é todo <= U+00FF.
                String apos = tentarUmaPassagemDuplaCodificacaoUtf8(cur);
                if (apos == null) {
                    break;
                }
                cur = apos;
            }
        }
        String out = corrigirLatin1Utf8EmCadeia(cur);
        out = substituirClustersBlocoDesenhoU251c(out);
        return corrigirLatin1Utf8EmCadeia(out);
    }

    /**
     * Quando UTF-8 válido contém U+251C (├, “box drawing”), a reversão Latin-1 ↔ UTF-8 entra em ciclo
     * (bytes UTF-8 da string decodificam de volta ao mesmo texto). Clusters frequentes em importação:
     * {@code ├âÔÇí├âãÆ} → {@code ÇÃ} (ex.: EXECUÇÃO) e {@code ├âãÆ} → {@code Ã} (ex.: PENSÃO).
     */
    private static String substituirClustersBlocoDesenhoU251c(String s) {
        if (s == null || s.isEmpty()) {
            return s;
        }
        if (s.indexOf('\u251c') < 0) {
            return s;
        }
        String t = s;
        // Ordem: padrões mais longos antes dos que compartilham prefixo (ex.: ├âÔÇ*).
        t = t.replace("\u251c\u00e2\u00d4\u00c7\u00ed\u251c\u00e2\u00e3\u00c6", "\u00c7\u00c3");
        t = t.replace("\u251c\u00e2\u00d4\u00c7\u2019", "\u00c9");
        t = t.replace("\u251c\u00e2\u00d4\u00c7\u0027", "\u00c9");
        // É: último byte UTF-8 virou U+2591 (░) em algumas importações (ex.: INDÉBITO).
        t = t.replace("\u251c\u00e2\u00d4\u00c7\u2591", "\u00c9");
        t = t.replace("\u251c\u00e2\u00e3\u00c6", "\u00c3");
        // ª feminino (ex.: 1ª turma): ├é┬¬ = U+251C U+00E9 U+252C U+00AC; variante ├é¬ª.
        t = t.replace("\u251c\u00e9\u252c\u00ac", "\u00aa");
        t = t.replace("\u251c\u00e9\u00ac\u00aa", "\u00aa");
        return t;
    }

    private static String tentarUmaPassagemDuplaCodificacaoUtf8(String s) {
        try {
            byte[] b2 = s.getBytes(StandardCharsets.UTF_8);
            String iso = reverterDuplaComTabelaLatin(b2, StandardCharsets.ISO_8859_1);
            String cp = reverterDuplaComTabelaLatin(b2, WINDOWS_1252);
            return escolherMelhorCandidatoDupla(s, iso, cp);
        } catch (Exception e) {
            return null;
        }
    }

    private static String reverterDuplaComTabelaLatin(byte[] b2, Charset latinCharset) {
        String latin = new String(b2, latinCharset);
        if (!latin1Somente(latin)) {
            return null;
        }
        String fixed = corrigirLatin1Utf8EmCadeia(latin);
        if (fixed.equals(latin)) {
            String leniente = decodificarLatin1ComoUtf8Leniente(latin);
            if (!leniente.equals(latin)) {
                fixed = corrigirLatin1Utf8EmCadeia(leniente);
            }
        }
        if (fixed.equals(latin)) {
            return null;
        }
        return fixed;
    }

    /** Entre ISO-8859-1 e CP1252, escolhe o texto com menos “lixo” de desenho de caixa e mais alfanumérico. */
    private static String escolherMelhorCandidatoDupla(String original, String a, String b) {
        String best = null;
        int bestScore = Integer.MIN_VALUE;
        for (String cand : new String[] {a, b}) {
            if (cand == null || cand.equals(original)) {
                continue;
            }
            int sc = pontuacaoLegivelPortugues(cand);
            if (sc > bestScore) {
                bestScore = sc;
                best = cand;
            }
        }
        return best;
    }

    private static int pontuacaoLegivelPortugues(String s) {
        int sc = 0;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
                sc += 4;
            } else if (c == ' ' || c == '.' || c == ',' || c == '-' || c == '/' || c == '(' || c == ')') {
                sc += 1;
            } else if (c >= '\u00c0' && c <= '\u024f') {
                sc += 3;
            } else if (c == 'º' || c == 'ª') {
                sc += 3;
            }
            if (c >= '\u2500' && c <= '\u257f') {
                sc -= 40;
            }
            if (c == '\ufffd') {
                sc -= 20;
            }
        }
        return sc;
    }

    private static boolean deveTentarReverterDuplaCamada(String s) {
        if (latin1Somente(s)) {
            return false;
        }
        if (temCjkProvavel(s)) {
            return false;
        }
        if (temParSurrogatoUtf16(s)) {
            return false;
        }
        return temBlocoBoxDrawingOuSubstituicao(s) || temSequenciaMojibakeLatinEstendido(s);
    }

    private static boolean temBlocoBoxDrawingOuSubstituicao(String s) {
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            if (ch >= '\u2500' && ch <= '\u257f') {
                return true;
            }
            if (ch == '\ufffd') {
                return true;
            }
        }
        return false;
    }

    private static boolean temSequenciaMojibakeLatinEstendido(String s) {
        if (s.length() < 2) {
            return false;
        }
        if (s.contains("Ã") || s.contains("Â") || s.contains("â€")) {
            return true;
        }
        for (int i = 0; i < s.length() - 1; i++) {
            char a = s.charAt(i);
            char b = s.charAt(i + 1);
            if (a == 'Ã' && b > ' ') {
                return true;
            }
            if (a == 'Â' && (b == '©' || b == '®' || b == '°' || b == 'ª' || b == '¢')) {
                return true;
            }
        }
        return false;
    }

    private static boolean temCjkProvavel(String s) {
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            if (ch >= 0x4e00 && ch <= 0x9fff) {
                return true;
            }
            if (ch >= 0x3040 && ch <= 0x30ff) {
                return true;
            }
            if (ch >= 0xac00 && ch <= 0xd7af) {
                return true;
            }
        }
        return false;
    }

    private static boolean temParSurrogatoUtf16(String s) {
        for (int i = 0; i < s.length(); i++) {
            if (Character.isHighSurrogate(s.charAt(i))) {
                return true;
            }
        }
        return false;
    }

    private static String decodificarLatin1ComoUtf8Leniente(String s) {
        if (!latin1Somente(s)) {
            return s;
        }
        byte[] raw = new byte[s.length()];
        for (int i = 0; i < s.length(); i++) {
            raw[i] = (byte) s.charAt(i);
        }
        return new String(raw, StandardCharsets.UTF_8);
    }

    private static String corrigirLatin1Utf8EmCadeia(String s) {
        String cur = s;
        for (int pass = 0; pass < MAX_PASSES_LATIN1_UTF8; pass++) {
            if (!latin1Somente(cur)) {
                return cur;
            }
            byte[] raw = new byte[cur.length()];
            for (int i = 0; i < cur.length(); i++) {
                raw[i] = (byte) cur.charAt(i);
            }
            CharsetDecoder decoder = StandardCharsets.UTF_8
                    .newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT);
            try {
                CharBuffer out = decoder.decode(ByteBuffer.wrap(raw));
                String next = out.toString();
                if (next.equals(cur)) {
                    return cur;
                }
                cur = next;
            } catch (CharacterCodingException e) {
                return cur;
            }
        }
        return cur;
    }

    private static boolean latin1Somente(String s) {
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) > 0xFF) {
                return false;
            }
        }
        return true;
    }
}
