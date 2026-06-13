package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class BackfillDescricaoNormRequest {

    private Integer loteSize = 2000;
}
