package br.com.vilareal.pje.infrastructure.browser;

public final class PjeTrt18CnjUtil {

    private PjeTrt18CnjUtil() {}

    public static String somenteDigitos(String cnj) {
        if (cnj == null) {
            return "";
        }
        return cnj.replaceAll("\\D", "");
    }

    /** TRT18: Justiça do Trabalho (J=5), tribunal 18 (Goiás). */
    public static boolean cnjEhTrt18(String cnj) {
        if (cnj == null || cnj.isBlank()) {
            return false;
        }
        return cnj.trim().toUpperCase().contains(".5.18.");
    }

    public static String nomeArquivoPdf(String cnj) {
        String digitos = somenteDigitos(cnj);
        if (digitos.length() == 20) {
            return String.format(
                    "Processo_%s-%s.%s.%s.%s.%s.pdf",
                    digitos.substring(0, 7),
                    digitos.substring(7, 9),
                    digitos.substring(9, 13),
                    digitos.substring(13, 14),
                    digitos.substring(14, 16),
                    digitos.substring(16, 20));
        }
        return "Processo_" + cnj.replaceAll("[^0-9A-Za-z.-]", "") + ".pdf";
    }
}
