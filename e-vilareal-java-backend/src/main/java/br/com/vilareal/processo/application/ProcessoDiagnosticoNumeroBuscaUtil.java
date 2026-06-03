package br.com.vilareal.processo.application;

import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;

import java.math.BigInteger;
import java.util.List;
import java.util.Locale;

/**
 * Normalização alinhada ao front {@code chaveNumeroProcessoBuscaDiagnostico} — remove pontos, traços e espaços,
 * depois mantém só dígitos para comparar com {@code REGEXP_REPLACE(numero_cnj, '[^0-9]', '')} na consulta nativa.
 */
public final class ProcessoDiagnosticoNumeroBuscaUtil {

    private ProcessoDiagnosticoNumeroBuscaUtil() {}

    /** Número interno Projudi nos emails de intimação (ex.: {@code 5780425.64}). */
    public static boolean ehNumeroProjudiInternoEmail(String raw) {
        if (raw == null) {
            return false;
        }
        return raw.trim().matches("(?i)\\d{4,9}\\.\\d{2}");
    }

    /**
     * Mesma regra usada em diagnósticos e vínculo automático de publicações:
     * CNJ completo (≥20 dígitos) por igualdade; fragmento (7–19 dígitos) por substring;
     * número interno Projudi ({@code NNNNNNN.DD}) por prefixo no CNJ cadastrado.
     */
    public static List<BigInteger> buscarIdsProcessoPorNumero(String numeroBruto, ProcessoRepository processoRepository) {
        String norm = normalizarSomenteDigitos(numeroBruto);
        if (norm.length() < 7) {
            return List.of();
        }
        if (norm.length() >= 20) {
            return processoRepository.findIdsByNumeroCnjNormalizadoDiagnostico(norm);
        }
        if (ehNumeroProjudiInternoEmail(numeroBruto)) {
            List<BigInteger> prefixo = processoRepository.findIdsByNumeroCnjDigitosIniciandoCom(norm);
            if (!prefixo.isEmpty()) {
                return prefixo;
            }
        }
        return processoRepository.findIdsByNumeroCnjDigitosContendo(norm);
    }

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
