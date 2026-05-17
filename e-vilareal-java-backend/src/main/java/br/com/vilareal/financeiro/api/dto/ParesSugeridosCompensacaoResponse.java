package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class ParesSugeridosCompensacaoResponse {

    private List<ParCompensacaoSugeridoResponse> pares;
    private long totalPares;
    private int page;
    private int totalPages;
}
