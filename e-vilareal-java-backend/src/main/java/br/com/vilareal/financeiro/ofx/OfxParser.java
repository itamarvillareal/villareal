package br.com.vilareal.financeiro.ofx;

import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parser mínimo de OFX bancário (blocos {@code STMTTRN}) com detecção de charset.
 */
public final class OfxParser {

    private static final Pattern STMTTRN_BLOCK =
            Pattern.compile("<STMTTRN>([\\s\\S]*?)</STMTTRN>", Pattern.CASE_INSENSITIVE);

    private OfxParser() {}

    public record OfxTransacao(
            String fitId,
            String trnType,
            LocalDate dataLancamento,
            BigDecimal trnAmt,
            String memo,
            String name) {}

    public static String decodificarOfx(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            return "";
        }
        OfxHeaderHints hints = parseHeaderHints(bytes);
        String porHints = decodificarComHints(bytes, hints);
        if (porHints != null) {
            return porHints;
        }
        try {
            return StandardCharsets.UTF_8
                    .newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes))
                    .toString();
        } catch (CharacterCodingException ex) {
            return decodificarLatinFallback(bytes);
        }
    }

    public static List<OfxTransacao> parseTransacoes(String ofxText) {
        List<OfxTransacao> out = new ArrayList<>();
        if (!StringUtils.hasText(ofxText)) {
            return out;
        }
        Matcher m = STMTTRN_BLOCK.matcher(ofxText);
        int idx = 0;
        Set<String> idsUsados = new HashSet<>();
        while (m.find()) {
            String block = m.group(0);
            out.add(parseBloco(block, idx, idsUsados));
            idx++;
        }
        return out;
    }

    private static OfxTransacao parseBloco(String block, int idx, Set<String> idsUsados) {
        String fitId = fitIdSignificativo(normalizar(getTagValue(block, "FITID")));
        String checkNum = checkNumSignificativo(getTagValue(block, "CHECKNUM"));
        String seq = String.valueOf(idx + 1);
        String id;
        if (StringUtils.hasText(fitId)) {
            id = fitId;
        } else if (StringUtils.hasText(checkNum)) {
            id = checkNum;
        } else {
            id = "ofx-" + seq;
        }
        if (idsUsados.contains(id)) {
            id = id + "-" + seq;
        }
        idsUsados.add(id);

        String trnAmtRaw = getTagValue(block, "TRNAMT");
        BigDecimal trnAmt = parseNumero(trnAmtRaw);
        LocalDate data = parseOfxDate(getTagValue(block, "DTPOSTED"));
        String memo = normalizar(getTagValue(block, "MEMO"));
        String name = normalizar(getTagValue(block, "NAME"));
        String trnType = normalizar(getTagValue(block, "TRNTYPE"));

        return new OfxTransacao(id, trnType, data, trnAmt, memo, name);
    }

    static LocalDate parseOfxDate(String dt) {
        if (!StringUtils.hasText(dt)) {
            return null;
        }
        String s = dt.trim();
        if (s.length() < 8) {
            return null;
        }
        try {
            int year = Integer.parseInt(s.substring(0, 4));
            int month = Integer.parseInt(s.substring(4, 6));
            int day = Integer.parseInt(s.substring(6, 8));
            return LocalDate.of(year, month, day);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static BigDecimal parseNumero(String raw) {
        if (!StringUtils.hasText(raw)) {
            return BigDecimal.ZERO;
        }
        String s = raw.trim().replace(',', '.');
        try {
            return new BigDecimal(s);
        } catch (NumberFormatException ex) {
            return BigDecimal.ZERO;
        }
    }

    private static String getTagValue(String block, String tag) {
        Matcher m = Pattern.compile(
                        "<" + Pattern.quote(tag) + ">([\\s\\S]*?)(?:</\\s*" + tag + "\\s*>|\\r?\\n|$)",
                        Pattern.CASE_INSENSITIVE)
                .matcher(block);
        return m.find() ? m.group(1) : "";
    }

    private static String normalizar(String s) {
        if (s == null) {
            return "";
        }
        return s.replaceAll("\\s+", " ").trim();
    }

    private static String checkNumSignificativo(String checkNum) {
        String c = normalizar(checkNum);
        if (!StringUtils.hasText(c)) {
            return "";
        }
        if (c.matches("0+")) {
            return "";
        }
        return c;
    }

    /** Caixa (CR LV OR E) envia FITID "0" — placeholder, não identificador único. */
    private static String fitIdSignificativo(String fitId) {
        String f = normalizar(fitId);
        if (!StringUtils.hasText(f)) {
            return "";
        }
        if (f.matches("0+")) {
            return "";
        }
        return f;
    }

    private record OfxHeaderHints(String encoding, String charset) {}

    private static OfxHeaderHints parseHeaderHints(byte[] bytes) {
        String prefix = decodeAsciiPrefix(bytes, 4096);
        String enc = extrairHeaderCampo(prefix, "ENCODING");
        String csRaw = extrairHeaderCampo(prefix, "CHARSET");
        return new OfxHeaderHints(
                enc != null ? enc.trim().toUpperCase(Locale.ROOT) : null, normalizarCharsetHint(csRaw));
    }

    private static String decodeAsciiPrefix(byte[] bytes, int maxLen) {
        int len = Math.min(bytes.length, maxLen);
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) {
            int b = bytes[i] & 0xFF;
            sb.append(b <= 127 ? (char) b : ' ');
        }
        return sb.toString();
    }

    private static String extrairHeaderCampo(String prefix, String campo) {
        Matcher m = Pattern.compile(campo + ":\\s*(\\S+)", Pattern.CASE_INSENSITIVE).matcher(prefix);
        return m.find() ? m.group(1) : null;
    }

    private static String normalizarCharsetHint(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String u = raw.trim().toUpperCase(Locale.ROOT).replaceAll("\\s+", "");
        return switch (u) {
            case "1252", "CP1252", "WINDOWS-1252", "WIN-1252", "MS-ANSI" -> "1252";
            case "8859-1", "ISO-8859-1", "ISO8859-1", "LATIN1", "LATIN-1" -> "8859-1";
            default -> u;
        };
    }

    private static String decodificarComHints(byte[] bytes, OfxHeaderHints hints) {
        if (hints == null) {
            return null;
        }
        Charset charset = null;
        if ("UTF-8".equals(hints.encoding())) {
            charset = StandardCharsets.UTF_8;
        } else if ("1252".equals(hints.charset())) {
            charset = Charset.forName("Windows-1252");
        } else if ("8859-1".equals(hints.charset())) {
            charset = StandardCharsets.ISO_8859_1;
        }
        if (charset == null) {
            return null;
        }
        CharBuffer decoded = charset.decode(ByteBuffer.wrap(bytes));
        return decoded.toString();
    }

    private static String decodificarLatinFallback(byte[] bytes) {
        try {
            return Charset.forName("Windows-1252").decode(ByteBuffer.wrap(bytes)).toString();
        } catch (RuntimeException ex) {
            return StandardCharsets.ISO_8859_1.decode(ByteBuffer.wrap(bytes)).toString();
        }
    }
}
