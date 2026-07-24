package br.com.vilareal.patrimonio.domain.finance;

public enum RecomendacaoAmortizacao {
    /** CET da dívida > retorno líquido da alternativa → amortizar cria valor. */
    AMORTIZAR,
    /** CET da dívida < retorno líquido → amortizar destrói valor. */
    MANTER_INVESTIDO,
    /** Diferencial dentro da banda de indiferença (±0,3 p.p.). */
    INDIFERENTE,
    /** Consórcio não contemplado — lógica de juros não se aplica. */
    CONSORCIO_NAO_APLICA_JUROS,
    /** Caixa livre insuficiente (ex.: margem de puts). */
    BLOQUEADO_LIQUIDEZ,
    /** Reserva de emergência ficaria abaixo do piso. */
    BLOQUEADO_RESERVA
}
