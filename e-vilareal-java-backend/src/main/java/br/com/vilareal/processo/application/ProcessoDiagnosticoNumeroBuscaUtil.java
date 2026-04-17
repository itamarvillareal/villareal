package br.com.vilareal.processo.application;

import java.util.Locale;

/**
 * Normalização alinhada ao front {@code chaveNumeroProcessoBuscaDiagnostico} — remove pontos, traços e espaços,
 * depois mantém só dígitos para comparar com {@code REGEXP_REPLACE(numero_cnj, '[^0-9]', '')} na consulta nativa.
 */
public final class ProcessoDiagnosticoNumeroBuscaUtil {

    private ProcessoDiagnosticoNumeroBuscaUtil() {}

    public static String normalizarSomenteDigitos(String raw) {
        if (raw == null) {
            return "";
        }
        String s = raw.trim().toUpperCase(Locale.ROOT);
        s = s.replace(".", "")
                .replace("-", "")
                .replace(" ", "")
                .replace("/", "")
                .replace("\u00AD", "")
                .replace("\u2013", "")
                .replace("\u2014", "");
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c >= '0' && c <= '9') {
                sb.append(c);
            }
        }
        return sb.toString();
    }
}
