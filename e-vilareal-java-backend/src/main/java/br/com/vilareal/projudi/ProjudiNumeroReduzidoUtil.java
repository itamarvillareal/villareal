package br.com.vilareal.projudi;

/**
 * Converte o {@code numero_cnj} completo no número reduzido recomendado pela
 * busca do PROJUDI-GO: sequencial (7 dígitos, sem zeros à esquerda) + dígito
 * verificador, no formato {@code sequencial.DD}.
 *
 * <p>Ex.: {@code 5717034-38.2026.8.09.0051} → {@code 5717034.38};
 * {@code 0148032-91.2009.8.09.0002} → {@code 148032.91}.</p>
 */
public final class ProjudiNumeroReduzidoUtil {

    private ProjudiNumeroReduzidoUtil() {}

    /**
     * @param numeroCnj número CNJ (com ou sem máscara) ou já reduzido.
     * @return {@code sequencial + "." + DD}; ou a entrada original quando há
     *         menos de 9 dígitos (não há como reduzir).
     */
    public static String cnjParaNumeroReduzido(String numeroCnj) {
        if (numeroCnj == null) {
            return null;
        }
        String digitos = numeroCnj.replaceAll("\\D", "");
        if (digitos.length() < 9) {
            return numeroCnj;
        }
        String sequencial = removerZerosEsquerda(digitos.substring(0, 7));
        String dd = digitos.substring(7, 9);
        return sequencial + "." + dd;
    }

    /** Remove zeros à esquerda mantendo ao menos 1 dígito. */
    private static String removerZerosEsquerda(String s) {
        int i = 0;
        while (i < s.length() - 1 && s.charAt(i) == '0') {
            i++;
        }
        return s.substring(i);
    }

    /** Apenas dígitos — para casar CNJ completo vs número reduzido. */
    public static String somenteDigitos(String numero) {
        if (numero == null) {
            return "";
        }
        return numero.replaceAll("\\D", "");
    }
}
