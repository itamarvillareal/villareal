package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class BackfillDescricaoNormResponse {

    private int atualizados;
    private long restantes;
}
