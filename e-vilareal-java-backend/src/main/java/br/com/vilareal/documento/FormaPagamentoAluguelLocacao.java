package br.com.vilareal.documento;

import org.springframework.util.StringUtils;

/** Forma de pagamento do aluguel na Cláusula 3ª do contrato de locação. */
public final class FormaPagamentoAluguelLocacao {

    public static final String DEPOSITO_TED = "DEPOSITO_TED";
    public static final String BOLETO = "BOLETO";
    public static final String PADRAO = DEPOSITO_TED;

    private FormaPagamentoAluguelLocacao() {}

    public static String normalizar(String valor) {
        if (!StringUtils.hasText(valor)) {
            return PADRAO;
        }
        String v = valor.trim().toUpperCase().replace(' ', '_').replace('-', '_');
        if (BOLETO.equals(v) || "BOLETOS".equals(v)) {
            return BOLETO;
        }
        return DEPOSITO_TED;
    }

    public static boolean isBoleto(String valor) {
        return BOLETO.equals(normalizar(valor));
    }
}
