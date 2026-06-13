package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class AplicarRecorrenciaResponse {

    private int aplicados;
    private Long regraCriadaId;
    private boolean jaExistiaRegra;
    private List<String> erros = new ArrayList<>();
}
