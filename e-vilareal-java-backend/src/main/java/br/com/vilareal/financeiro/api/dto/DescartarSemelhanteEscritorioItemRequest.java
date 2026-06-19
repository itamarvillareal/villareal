package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DescartarSemelhanteEscritorioItemRequest {

    @NotNull
    private Long lancamentoId;

    @NotNull
    private Long clienteId;

    @NotNull
    private Long processoId;
}
