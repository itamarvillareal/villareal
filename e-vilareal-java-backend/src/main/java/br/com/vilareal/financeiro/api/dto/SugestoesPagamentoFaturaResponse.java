package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class SugestoesPagamentoFaturaResponse {
    private List<SugestaoPagamentoFaturaResponse> sugestoes = new ArrayList<>();
    private long totalSugestoes;
    private int page;
    private int totalPages;
}
