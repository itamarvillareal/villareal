package br.com.vilareal.documento;

import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.regex.Matcher;

/** Prazo da locação (Cláusula 2ª) a partir da vigência do contrato. */
public final class LocacaoPrazoUtil {

    private LocacaoPrazoUtil() {}

    /**
     * Mesma regra do legado Access/VBA ({@code Meses_Juros} em {@code Calcula_Juros}):
     * diferença de meses calendário e +1 quando o dia final é posterior ao dia inicial.
     */
    public static int calcularMesesLocacao(LocalDate dataInicio, LocalDate dataFim) {
        if (dataInicio == null || dataFim == null || dataFim.isBefore(dataInicio)) {
            return 0;
        }
        int meses =
                (dataFim.getYear() - dataInicio.getYear()) * 12 + (dataFim.getMonthValue() - dataInicio.getMonthValue());
        if (dataFim.getDayOfMonth() > dataInicio.getDayOfMonth()) {
            meses++;
        }
        return Math.max(0, meses);
    }

    public static String formatarPrazoMeses(int meses) {
        if (meses <= 0) {
            return "";
        }
        return meses == 1 ? "1 mês" : meses + " meses";
    }

    public static String calcularPrazoLocacaoTexto(LocalDate dataInicio, LocalDate dataFim) {
        return formatarPrazoMeses(calcularMesesLocacao(dataInicio, dataFim));
    }

    /** Substitui o «12 meses» fixo do modelo legado pelo prazo calculado. */
    public static String substituirPrazoLocacaoHardcoded(String texto, String prazoTexto) {
        if (!StringUtils.hasText(texto) || !StringUtils.hasText(prazoTexto)) {
            return texto != null ? texto : "";
        }
        return texto.replaceAll("(?i)\\b12 meses\\b", Matcher.quoteReplacement(prazoTexto.trim()));
    }
}
