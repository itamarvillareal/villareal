package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ParearCompensacaoErroResponse {

    private Long lancamentoIdA;
    private Long lancamentoIdB;
    private String motivo;
}
