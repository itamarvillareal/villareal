package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AplicarSugestaoRequest {

    @NotNull
    private Long lancamentoId;

    @NotNull
    private Long contaContabilId;

    private Long clienteId;
    private Long processoId;
}
