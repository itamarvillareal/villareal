package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

/** Criação/edição do rascunho de acerto (Etapa 5b). */
@Getter
@Setter
public class AcertoFechamentoWriteRequest {

    @NotNull
    private Long clienteId;

    @NotNull
    private Integer numeroBanco;

    private LocalDate periodoInicio;

    private LocalDate periodoFim;

    private String observacoes;
}
