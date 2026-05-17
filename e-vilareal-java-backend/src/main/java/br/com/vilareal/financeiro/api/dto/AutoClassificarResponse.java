package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Getter
@Setter
public class AutoClassificarResponse {

    private boolean simulacao;
    private int candidatos;
    private int classificaveis;
    private Map<String, Integer> porConta = new LinkedHashMap<>();
    private List<AutoClassificarDetalheResponse> detalhes;
}
