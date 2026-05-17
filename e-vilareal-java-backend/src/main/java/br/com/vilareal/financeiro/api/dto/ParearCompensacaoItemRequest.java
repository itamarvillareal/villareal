package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ParearCompensacaoItemRequest {

    @NotNull
    private Long lancamentoIdA;

    @NotNull
    private Long lancamentoIdB;

    private String grupoCompensacao;
}
