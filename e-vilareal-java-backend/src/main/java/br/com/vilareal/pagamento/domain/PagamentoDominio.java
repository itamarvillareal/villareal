package br.com.vilareal.pagamento.domain;

import java.util.Set;

public final class PagamentoDominio {

    private PagamentoDominio() {}

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

    public static final Set<String> STATUS_FINAIS_PAGO = Set.of(ST_PAGO_CONFIRMADO, ST_PAGO_SEM_COMPROVANTE);

    public static final Set<String> STATUS_POS_PAGAMENTO = Set.of(
            ST_PAGO_CONFIRMADO, ST_PAGO_SEM_COMPROVANTE, ST_CONFERIDO, ST_ACERTADO);

    public static final Set<String> STATUS_ELEGIVEL_ACERTO = Set.of(ST_CONFERIDO);
}
