package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** Linha da visão do acerto agrupada por processo (Etapa 5). Proc nulo = mensalidades e avulsos. */
@Getter
@Setter
public class AcertoResumoProcessoResponse {

    private Long processoId;
    private Integer numeroInterno;
    /** Partes do processo ("AUTOR x RÉU"); nulo para o grupo sem processo. */
    private String partes;
    private long qtdLancamentos;
    private BigDecimal somaCreditos = BigDecimal.ZERO;
    private BigDecimal somaDebitos = BigDecimal.ZERO;
    private BigDecimal saldo = BigDecimal.ZERO;
    /** Sem grupo de compensação. */
    private long pendentes;
    /** Sem marcação de conferência. */
    private long naoConferidos;
    private Instant ultimaConferencia;
    private LocalDate primeiraData;
    private LocalDate ultimaData;
}
