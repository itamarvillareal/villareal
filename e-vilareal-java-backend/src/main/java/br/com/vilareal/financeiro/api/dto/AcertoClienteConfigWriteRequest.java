package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Upsert da Ficha do Acerto por cliente (Etapa 5b). */
@Getter
@Setter
public class AcertoClienteConfigWriteRequest {

    @NotNull
    private Long clienteId;

    private BigDecimal percentualRepasse;

    private String observacoes;

    /** Corte manual do histórico pré-sistema (ex.: SE77E 10/01/2024). */
    private LocalDate dataUltimoAcertoConhecido;
}
