package br.com.vilareal.condominio.application;

import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Conversão entre código de unidade (XLS) e rótulo persistido no processo. */
public final class CobrancaUnidadeFormatUtil {

    private static final String TORRES = "ABRV";
    private static final Pattern PAT_COD_LETRA_HIFEN_DIGITOS =
            Pattern.compile("^([" + TORRES + "])-(\\d{3,4})$", Pattern.CASE_INSENSITIVE);
    private static final Pattern PAT_COD_LETRA_DIGITOS =
            Pattern.compile("^([" + TORRES + "])(\\d{3,4})$", Pattern.CASE_INSENSITIVE);
    private static final Pattern PAT_COD_DIGITOS_HIFEN_LETRA =
            Pattern.compile("^(\\d{3,4})-([" + TORRES + "])$", Pattern.CASE_INSENSITIVE);
    private static final Pattern PAT_COD_DIGITOS_LETRA =
            Pattern.compile("^(\\d{3,4})([" + TORRES + "])$", Pattern.CASE_INSENSITIVE);
    private static final Pattern PAT_COD_DIGITOS_ESPACO_LETRA =
            Pattern.compile("^(\\d{3,4})\\s+([" + TORRES + "])$", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern PAT_COD_LETRA_4DIG =
            Pattern.compile("^([" + TORRES + "])-(\\d{4})$", Pattern.CASE_INSENSITIVE);
    private static final Pattern PAT_UNIDADE_LEGIVEL =
            Pattern.compile("^Unidade\\s+(\\d+)\\s+([" + TORRES + "])$", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private CobrancaUnidadeFormatUtil() {}

    /**
     * Normaliza códigos vindos do XLS/planilha para o formato canônico {@code A-0203}.
     * Aceita {@code A0402}, {@code 000-A}, {@code 1201 R}, {@code 000A}, etc.
     */
    public static String normalizarCodigoUnidade(String codigoBruto) {
        if (!StringUtils.hasText(codigoBruto)) {
            return "";
        }
        String u = codigoBruto.trim().toUpperCase(Locale.ROOT);
        if (u.endsWith("*")) {
            u = u.substring(0, u.length() - 1).trim();
        }
        if ("ADM".equals(u)) {
            return "ADM";
        }

        Matcher m = PAT_COD_LETRA_HIFEN_DIGITOS.matcher(u.replace(" ", ""));
        if (m.matches()) {
            return codigoCanonico(m.group(1), m.group(2));
        }

        String compact = u.replaceAll("\\s+", "");
        m = PAT_COD_LETRA_DIGITOS.matcher(compact);
        if (m.matches()) {
            return codigoCanonico(m.group(1), m.group(2));
        }

        m = PAT_COD_DIGITOS_HIFEN_LETRA.matcher(compact);
        if (m.matches()) {
            return codigoCanonico(m.group(2), m.group(1));
        }

        m = PAT_COD_DIGITOS_LETRA.matcher(compact);
        if (m.matches()) {
            return codigoCanonico(m.group(2), m.group(1));
        }

        m = PAT_COD_DIGITOS_ESPACO_LETRA.matcher(u);
        if (m.matches()) {
            return codigoCanonico(m.group(2), m.group(1));
        }

        return u;
    }

    /**
     * {@code A-0203} → {@code Unidade 203 A} (mesmo padrão do script de acordos / cadastro legado).
     * Códigos não reconhecidos (ex.: {@code ADM}) permanecem como estão.
     */
    public static String codigoParaUnidadeProcesso(String codigoNormalizado) {
        if (!StringUtils.hasText(codigoNormalizado)) {
            return "";
        }
        String cod = normalizarCodigoUnidade(codigoNormalizado);
        Matcher m = PAT_COD_LETRA_4DIG.matcher(cod);
        if (m.matches()) {
            int num = Integer.parseInt(m.group(2), 10);
            return "Unidade " + num + " " + m.group(1).toUpperCase(Locale.ROOT);
        }
        return cod;
    }

    /** Chaves possíveis já gravadas em {@code processo.unidade} para o mesmo código. */
    public static List<String> chavesBuscaProcessoPorCodigo(String codigoNormalizado) {
        Set<String> out = new LinkedHashSet<>();
        if (!StringUtils.hasText(codigoNormalizado)) {
            return List.of();
        }
        String cod = normalizarCodigoUnidade(codigoNormalizado);
        out.add(cod);
        String legivel = codigoParaUnidadeProcesso(cod);
        if (StringUtils.hasText(legivel)) {
            out.add(legivel);
        }
        Matcher m = PAT_COD_LETRA_4DIG.matcher(cod);
        if (m.matches()) {
            String letra = m.group(1).toUpperCase(Locale.ROOT);
            String digits4 = m.group(2);
            int num = Integer.parseInt(digits4, 10);
            String digitsTrim = String.valueOf(num);
            String digits3 = String.format("%03d", num);

            out.add(digits4 + " " + letra);
            out.add(digitsTrim + " " + letra);
            out.add(letra + digits4);
            out.add(letra + digitsTrim);
            out.add(letra + "-" + digits4);
            out.add(letra + "-" + digitsTrim);
            out.add(digits4 + "-" + letra);
            out.add(digitsTrim + "-" + letra);
            out.add(String.format("%03d-%s", num, letra));
            out.add(digits4 + letra);
            out.add(digitsTrim + letra);
            out.add(String.format("%03d%s", num, letra));
            out.add(String.format("%03d %s", num, letra));
            out.add("Unidade " + digitsTrim + " " + letra);
            out.add("Unidade " + digits3 + " " + letra);
            out.add("Unidade " + digits4 + " " + letra);
        }
        return new ArrayList<>(out);
    }

    public static boolean ehFormatoCodigoUnidade(String unidade) {
        if (!StringUtils.hasText(unidade)) {
            return false;
        }
        String t = unidade.trim().toUpperCase(Locale.ROOT);
        String compact = t.replaceAll("\\s+", "");
        return PAT_COD_LETRA_4DIG.matcher(t).matches()
                || PAT_COD_LETRA_DIGITOS.matcher(compact).matches()
                || PAT_COD_DIGITOS_HIFEN_LETRA.matcher(compact).matches()
                || PAT_COD_DIGITOS_LETRA.matcher(compact).matches()
                || PAT_COD_DIGITOS_ESPACO_LETRA.matcher(t).matches();
    }

    public static boolean ehFormatoUnidadeLegivel(String unidade) {
        if (!StringUtils.hasText(unidade)) {
            return false;
        }
        return PAT_UNIDADE_LEGIVEL.matcher(unidade.trim()).matches();
    }

    private static String codigoCanonico(String letra, String digitos) {
        int v = Integer.parseInt(digitos, 10);
        return letra.toUpperCase(Locale.ROOT) + "-" + String.format("%04d", v);
    }
}
