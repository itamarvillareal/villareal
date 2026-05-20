package br.com.vilareal.pessoa.importacao;

import br.com.vilareal.common.text.PortuguesTextoCorrecaoUtil;
import br.com.vilareal.common.text.Utf8MojibakeUtil;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Normalização e truncagem alinhadas ao schema {@code pessoa} / complementar / endereço / contato.
 */
public final class CadastroPessoasPlanilhaImportSupport {

    private static final Pattern NON_DIGITS = Pattern.compile("\\D+");

    public enum CpfCnpjResultado {
        AUSENTE,
        INVALIDO,
        VALIDO
    }

    public record CpfCnpjNormalizado(CpfCnpjResultado resultado, String valor) {}

    private CadastroPessoasPlanilhaImportSupport() {}

    /**
     * Corrige texto livre vindo de células Excel antes de truncar/persistir.
     * Delega em {@link Utf8MojibakeUtil#corrigir(String)} (mesma lógica que API e portal).
     *
     * @param raw valor cru ({@link String} já interpretado pela POI / JVM).
     */
    public static String corrigirMojibakePlanilhaUtf8(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String fixed = Utf8MojibakeUtil.corrigir(raw);
        return fixed != null ? fixed : "";
    }

    /**
     * Mojibake + U+FFFD + léxico (mesma rotina que histórico de processos e reparo Flyway).
     * Alinhado a {@code scripts/lib/normalizar-texto-planilha.mjs} no front.
     */
    public static String normalizarTextoPlanilha(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String fixed = PortuguesTextoCorrecaoUtil.normalizar(raw);
        return fixed != null ? fixed : "";
    }

    /** {@link #truncate}({@link #normalizarTextoPlanilha}(raw), max). */
    public static String truncatePlanilhaTexto(String raw, int max) {
        return truncate(normalizarTextoPlanilha(raw == null ? "" : raw), max);
    }

    public static String digitsOnly(String s) {
        if (s == null) return "";
        return NON_DIGITS.matcher(s.trim()).replaceAll("");
    }

    /**
     * Ausente (sem dígitos), inválido (número de dígitos ≠ 11 nem 14) ou válido (11 ou 14 dígitos).
     */
    public static CpfCnpjNormalizado analisarCpfCnpj(String raw) {
        String d = digitsOnly(raw);
        if (d.isEmpty()) {
            return new CpfCnpjNormalizado(CpfCnpjResultado.AUSENTE, null);
        }
        if (d.length() == 11 || d.length() == 14) {
            return new CpfCnpjNormalizado(CpfCnpjResultado.VALIDO, d);
        }
        return new CpfCnpjNormalizado(CpfCnpjResultado.INVALIDO, null);
    }

    /**
     * CPF 11 ou CNPJ 14 dígitos; {@link Optional#empty()} se ausente ou inválido (compatível com fluxos antigos).
     */
    public static Optional<String> normalizeCpfCnpj(String raw) {
        CpfCnpjNormalizado n = analisarCpfCnpj(raw);
        if (n.resultado() == CpfCnpjResultado.VALIDO) {
            return Optional.of(n.valor());
        }
        return Optional.empty();
    }

    /**
     * CPF 11 ou CNPJ 14 dígitos a partir do valor bruto ou do campo já normalizado (ex. payload reenviado pelo front).
     */
    public static String resolveCpfCnpjDigitosPlanilha(String cpfCnpjBruto, String cpfCnpjNormalizado) {
        Optional<String> o = normalizeCpfCnpj(cpfCnpjBruto);
        if (o.isEmpty()) {
            o = normalizeCpfCnpj(cpfCnpjNormalizado);
        }
        return o.orElse("");
    }

    public static String normalizeCep(String raw) {
        String d = digitsOnly(raw);
        return d.length() > 8 ? d.substring(0, 8) : d;
    }

    /**
     * UF com 2 letras; se a célula vier com nome longo, tenta heurística mínima (primeiras 2 letras latinas).
     */
    public static String normalizeUf(String raw) {
        if (raw == null) return "";
        String t = raw.trim().toUpperCase(Locale.ROOT).replaceAll("\\s+", " ");
        if (t.length() == 2 && t.chars().allMatch(Character::isLetter)) {
            return t;
        }
        if (t.length() > 2) {
            StringBuilder sb = new StringBuilder(2);
            for (int i = 0; i < t.length() && sb.length() < 2; i++) {
                char c = t.charAt(i);
                if (c >= 'A' && c <= 'Z') {
                    sb.append(c);
                }
            }
            if (sb.length() == 2) {
                return sb.toString();
            }
        }
        return "";
    }

    public static String truncate(String s, int max) {
        if (s == null) return "";
        String t = s.trim();
        return t.length() <= max ? t : t.substring(0, max);
    }

    /**
     * Nome no cadastro de pessoas: normalização de texto, truncagem a 255 e maiúsculas ({@link Locale#ROOT}).
     */
    public static String normalizeNomeCadastro(String raw) {
        return truncate(normalizarTextoPlanilha(raw), 255).toUpperCase(Locale.ROOT);
    }

    /** Remove ';' final e trim; não força lower no valor persistido (só para chave de duplicata). */
    public static String normalizeEmailForStorage(String raw) {
        if (raw == null) return "";
        String t = normalizarTextoPlanilha(raw);
        while (t.endsWith(";")) {
            t = t.substring(0, t.length() - 1).trim();
        }
        return truncate(t, 255);
    }

    public static String emailDuplicateKey(String storedEmail) {
        if (storedEmail == null || storedEmail.isBlank()) {
            return "";
        }
        return storedEmail.toLowerCase(Locale.ROOT);
    }

    public static LocalDate excelDateToLocalDate(double numeric, boolean dateFormatted) {
        if (!dateFormatted) {
            return null;
        }
        try {
            return org.apache.poi.ss.usermodel.DateUtil.getJavaDate(numeric)
                    .toInstant()
                    .atZone(ZoneId.of("UTC"))
                    .toLocalDate();
        } catch (Exception e) {
            return null;
        }
    }

    public static String mergeTelefoneValor(String telDigitsOrFormatted, String inf) {
        String t = telDigitsOrFormatted == null ? "" : telDigitsOrFormatted.trim();
        String i = inf == null ? "" : inf.trim();
        if (i.isEmpty()) {
            return truncate(t, 500);
        }
        String merged = t.isEmpty() ? i : t + " — " + i;
        return truncate(merged, 500);
    }
}
