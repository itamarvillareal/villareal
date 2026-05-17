package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GrupoCompensacaoLoteResult {

    private int atualizados;
    private int naoEncontrados;
    private int ignorados;
}
