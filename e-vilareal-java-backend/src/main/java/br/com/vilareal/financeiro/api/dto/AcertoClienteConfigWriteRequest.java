package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** Upsert da Ficha do Acerto por cliente (Etapa 5b). */
@Getter
@Setter
public class AcertoClienteConfigWriteRequest {

    @NotNull
    private Long clienteId;

    private BigDecimal percentualRepasse;

    private String observacoes;
}
