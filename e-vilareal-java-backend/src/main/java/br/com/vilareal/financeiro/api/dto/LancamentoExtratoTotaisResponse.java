package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** Totais agregados do recorte filtrado do extrato (barra fixa da tela de acerto — Etapa 5). */
@Getter
@Setter
public class LancamentoExtratoTotaisResponse {

    private long quantidade;
    private BigDecimal somaCreditos = BigDecimal.ZERO;
    private BigDecimal somaDebitos = BigDecimal.ZERO;
    /** Assinado (créditos − débitos). */
    private BigDecimal saldo = BigDecimal.ZERO;
    /** Sem grupo de compensação. */
    private long pendentes;
    /** Sem marcação de conferência. */
    private long naoConferidos;
}
