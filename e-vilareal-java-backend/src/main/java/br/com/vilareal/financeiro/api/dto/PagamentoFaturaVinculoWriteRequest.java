package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PagamentoFaturaVinculoWriteRequest {

    @NotNull
    private Long lancamentoBancoId;

    @NotNull
    private Long lancamentoCartaoId;
}
