package br.com.vilareal.financeiro.domain;

/**
 * Status de visibilidade do lançamento no extrato/consolidado.
 * {@link #APOSENTADO} oculta o registro das leituras operacionais sem apagar a linha (UK e dedup intactos).
 */
public final class StatusLancamento {

    public static final String ATIVO = "ATIVO";
    public static final String APOSENTADO = "APOSENTADO";

    private StatusLancamento() {}

    public static boolean isAtivo(String status) {
        return status == null || ATIVO.equalsIgnoreCase(status.trim());
    }

    public static boolean isAposentado(String status) {
        return status != null && APOSENTADO.equalsIgnoreCase(status.trim());
    }
}
