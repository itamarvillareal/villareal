package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class ParearCompensacaoResponse {

    private int pareados;
    private int comDiferenca;
    private List<ParearCompensacaoErroResponse> erros = new ArrayList<>();
    private List<String> gruposGerados = new ArrayList<>();
}
