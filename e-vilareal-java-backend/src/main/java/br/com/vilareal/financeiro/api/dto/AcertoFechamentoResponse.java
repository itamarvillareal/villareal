package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** Acerto (fechamento como evento) — Etapa 5b. */
@Getter
@Setter
public class AcertoFechamentoResponse {

    private Long id;
    private Long clienteId;
    private String codigoCliente;
    private String clienteNome;
    private Integer numeroBanco;
    private LocalDate periodoInicio;
    private LocalDate periodoFim;
    private Instant dataFechamento;
    private BigDecimal saldoFinal;
    private String status;
    private String observacoes;
    private boolean temPdf;
    private long qtdGrupos;
    private String criadoPorNome;
    private String fechadoPorNome;
    private Instant createdAt;
}
