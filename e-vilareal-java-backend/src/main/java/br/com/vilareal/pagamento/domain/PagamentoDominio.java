package br.com.vilareal.pagamento.domain;

import java.util.Map;
import java.util.Set;

public final class PagamentoDominio {

    private PagamentoDominio() {}

    public static final String TIPO_PAGAR = "PAGAR";
    public static final String TIPO_RECEBER = "RECEBER";

    public static final String ST_PENDENTE = "PENDENTE";
    public static final String ST_AGENDADO = "AGENDADO";
    public static final String ST_PAGO_CONFIRMADO = "PAGO_CONFIRMADO";
    public static final String ST_PAGO_SEM_COMPROVANTE = "PAGO_SEM_COMPROVANTE";
    public static final String ST_CONFERENCIA_PENDENTE = "CONFERENCIA_PENDENTE";
    public static final String ST_VENCIDO = "VENCIDO";
    public static final String ST_CANCELADO = "CANCELADO";
    public static final String ST_SUBSTITUIDO = "SUBSTITUIDO";
    public static final String ST_CONFERIDO = "CONFERIDO";
    public static final String ST_ACERTADO = "ACERTADO";

    /** Status de cobrança / recebível. */
    public static final String ST_EMITIDO = "EMITIDO";
    public static final String ST_RECEBIDO = "RECEBIDO";
    public static final String ST_CONCILIADO = "CONCILIADO";

    public static final Set<String> STATUS_VALIDOS = Set.of(
            ST_PENDENTE,
            ST_AGENDADO,
            ST_PAGO_CONFIRMADO,
            ST_PAGO_SEM_COMPROVANTE,
            ST_CONFERENCIA_PENDENTE,
            ST_VENCIDO,
            ST_CANCELADO,
            ST_SUBSTITUIDO,
            ST_CONFERIDO,
            ST_ACERTADO);

    public static final Set<String> STATUS_VALIDOS_RECEBER = Set.of(
            ST_EMITIDO, ST_RECEBIDO, ST_CONCILIADO, ST_VENCIDO, ST_CANCELADO);

    public static final Set<String> STATUS_FINAIS_PAGO = Set.of(ST_PAGO_CONFIRMADO, ST_PAGO_SEM_COMPROVANTE);

    public static final Set<String> STATUS_POS_PAGAMENTO = Set.of(
            ST_PAGO_CONFIRMADO, ST_PAGO_SEM_COMPROVANTE, ST_CONFERIDO, ST_ACERTADO);

    public static final Set<String> STATUS_ELEGIVEL_ACERTO = Set.of(ST_CONFERIDO);

    public static final Set<String> TIPOS_VALIDOS = Set.of(TIPO_PAGAR, TIPO_RECEBER);

    private static final Map<String, Set<String>> TRANSICOES_RECEBER = Map.of(
            ST_EMITIDO, Set.of(ST_RECEBIDO, ST_VENCIDO, ST_CANCELADO),
            ST_VENCIDO, Set.of(ST_RECEBIDO, ST_CANCELADO),
            ST_RECEBIDO, Set.of(ST_CONCILIADO, ST_CANCELADO));

    public static boolean isTipoPagar(String tipo) {
        return tipo == null || TIPO_PAGAR.equalsIgnoreCase(tipo.trim());
    }

    public static boolean isTipoReceber(String tipo) {
        return TIPO_RECEBER.equalsIgnoreCase(tipo != null ? tipo.trim() : "");
    }

    public static String normalizarTipo(String tipo) {
        if (tipo == null || tipo.isBlank()) {
            return TIPO_PAGAR;
        }
        return tipo.trim().toUpperCase();
    }

    public static Set<String> statusValidosPara(String tipo) {
        return isTipoReceber(tipo) ? STATUS_VALIDOS_RECEBER : STATUS_VALIDOS;
    }

    public static boolean statusValidoPara(String tipo, String status) {
        return status != null && statusValidosPara(tipo).contains(status.trim());
    }

    /**
     * Transições válidas de recebível (independente do fluxo de contas a pagar).
     */
    public static boolean transicaoReceberPermitida(String statusAtual, String statusNovo) {
        if (statusAtual == null || statusNovo == null) {
            return false;
        }
        if (statusAtual.equals(statusNovo)) {
            return true;
        }
        Set<String> destinos = TRANSICOES_RECEBER.get(statusAtual);
        return destinos != null && destinos.contains(statusNovo);
    }

    public static String statusInicialPara(String tipo) {
        return isTipoReceber(tipo) ? ST_EMITIDO : ST_PENDENTE;
    }
}
