package br.com.vilareal.processo.application;

import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Normalização alinhada ao front {@code chaveNumeroProcessoBuscaDiagnostico} — remove pontos, traços e espaços,
 * depois mantém só dígitos para comparar com {@code REGEXP_REPLACE(numero_cnj, '[^0-9]', '')} na consulta nativa.
 */
public final class ProcessoDiagnosticoNumeroBuscaUtil {

    private ProcessoDiagnosticoNumeroBuscaUtil() {}

    /** Número interno Projudi nos emails de intimação (ex.: {@code 5780425.64}, {@code 5829123.7}). */
    public static boolean ehNumeroProjudiInternoEmail(String raw) {
        if (raw == null) {
            return false;
        }
        return raw.trim().matches("(?i)\\d{4,9}\\.\\d{1,2}");
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
            for (String variante : variantesCnjIgualdadeDiagnostico(norm)) {
                List<BigInteger> ids = processoRepository.findIdsByNumeroCnjNormalizadoDiagnostico(variante);
                if (!ids.isEmpty()) {
                    return ids;
                }
            }
            return List.of();
        }
        if (ehNumeroProjudiInternoEmail(numeroBruto)) {
            // Só prefixo exato (9 dígitos = sequencial + DV). Sem fallback «contém» nem fuzzy —
            // ex.: 5500622.97 ≠ 5505622-97 (Vânia vs Asfarol).
            return processoRepository.findIdsByNumeroCnjDigitosIniciandoCom(norm);
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

    /**
     * CNJ legado (txt/import): sequencial com 6 dígitos → 19 dígitos; completo = 20.
     * Gera variantes para igualdade na busca (20 com zero à esquerda e 19 sem).
     */
    public static String padCnjDigitos19para20(String digits) {
        if (digits == null) {
            return "";
        }
        String d = digits.replaceAll("\\D", "");
        if (d.length() == 19) {
            return "0" + d;
        }
        return d;
    }

    public static List<String> variantesCnjIgualdadeDiagnostico(String norm) {
        if (norm == null || norm.isBlank()) {
            return List.of();
        }
        Set<String> set = new LinkedHashSet<>();
        String canon = padCnjDigitos19para20(norm);
        if (!canon.isBlank()) {
            set.add(canon);
        }
        if (canon.length() == 20 && canon.startsWith("0")) {
            set.add(canon.substring(1));
        } else if (norm.length() == 19) {
            set.add(norm);
        }
        return new ArrayList<>(set);
    }
}
