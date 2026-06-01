package br.com.vilareal.agenda.application;

import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.time.LocalDate;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * Normalização da chave de conteúdo — alinhada a {@code scripts/lib/agenda-conteudo-key.mjs}.
 * Entrada com mojibake corrigido via {@link AgendaConteudoKeyService#calcular}.
 */
public final class AgendaEventoConteudoKeyUtil {

    private static final Pattern HORA_HM = Pattern.compile("^(\\d{1,2})[h:.](\\d{2})$", Pattern.CASE_INSENSITIVE);

    private AgendaEventoConteudoKeyUtil() {}

    public static String gerar(
            Long usuarioId, LocalDate dataEvento, String horaEvento, String descricao, String statusCurto) {
        if (usuarioId == null || dataEvento == null) {
            return null;
        }
        String hora = normalizarHoraParaChave(horaEvento);
        String desc = normalizarDescricaoParaChave(descricao);
        String status = normalizarStatusParaChave(statusCurto);
        String descHash = sha256Hex(desc);
        return usuarioId + "|" + dataEvento + "|" + hora + "|" + descHash + "|" + status;
    }

    /** Hora normalizada ou string vazia (sem horário fixo). */
    public static String normalizarHoraParaChave(String val) {
        if (val == null) {
            return "";
        }
        String s = val.trim();
        if (s.isEmpty() || ".....".equals(s)) {
            return "";
        }
        Matcher m = HORA_HM.matcher(s);
        if (m.matches()) {
            int hh = Integer.parseInt(m.group(1));
            int mm = Integer.parseInt(m.group(2));
            if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
                return String.format(Locale.ROOT, "%02d:%02d", hh, mm);
            }
        }
        String digits = s.replaceAll("\\D", "");
        if (digits.length() == 3 || digits.length() == 4) {
            int hh = Integer.parseInt(digits.substring(0, digits.length() - 2));
            int mm = Integer.parseInt(digits.substring(digits.length() - 2));
            if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
                return String.format(Locale.ROOT, "%02d:%02d", hh, mm);
            }
        }
        return "";
    }

    /** Descrição como na API (vazia → «Compromisso»), sem acentos, minúscula, espaços colapsados. */
    public static String normalizarDescricaoParaChave(String raw) {
        String d = raw == null ? "" : raw.trim();
        if (!StringUtils.hasText(d)) {
            d = "Compromisso";
        }
        d = Normalizer.normalize(d, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return d.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    /** {@code OK} ou string vazia. */
    public static String normalizarStatusParaChave(String raw) {
        if (!StringUtils.hasText(raw)) {
            return "";
        }
        return "OK".equalsIgnoreCase(raw.trim()) ? "OK" : "";
    }

    static String sha256Hex(String text) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest((text == null ? "" : text).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 indisponível", e);
        }
    }
}
