package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class GruposCompensacaoInconsistentesResponse {

    private long total;
    private List<GrupoCompensacaoInconsistenteResponse> grupos;
    private int page;
    private int totalPages;
}
