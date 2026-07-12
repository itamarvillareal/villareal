package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Um período delimitado do acerto (Etapa 5c): fechado (manual/auto/formal) ou aberto. */
@Getter
@Setter
public class AcertoResumoPeriodoResponse {

    /** Índice na lista (0-based). */
    private int indice;

    /**
     * FECHADO_MANUAL (corte na Ficha), FECHADO_AUTO (saldo zerou), FECHADO (acerto_fechamento
     * formal), ABERTO (mesa de trabalho atual).
     */
    private String status;

    private LocalDate dataInicio;
    /** {@code null} no período aberto (sem data fim). */
    private LocalDate dataFim;

    private BigDecimal saldoFinal = BigDecimal.ZERO;
    private long qtdLancamentos;
    private long qtdProcessos;
    private long pendentes;
    private long naoConferidos;

    /** Preenchido quando status = FECHADO (fechamento formal com PDF). */
    private Long fechamentoId;
    private boolean temPdf;

    /** Card fechado por grupo_compensacao (bloco da planilha / parear-grupo). */
    private String grupoCompensacao;
    /** Primeiro comentário significativo do bloco (ex.: "Compensado no Contrato mensal..."). */
    private String titulo;
    /** Nº interno do processo quando o card envolve um único proc. */
    private Integer numeroInternoProcesso;

    /** CARD (FECHADO_GRUPO), HISTORICO (manual/auto/formal) ou ABERTO — facilita a UI. */
    private String tipoPeriodo;
}
