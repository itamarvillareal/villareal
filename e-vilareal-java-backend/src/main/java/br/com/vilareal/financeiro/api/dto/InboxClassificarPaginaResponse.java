package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Getter
@Setter
public class InboxClassificarPaginaResponse {

    private List<LancamentoFinanceiroResponse> content = List.of();
    private long totalElements;
    private int totalPages;
    private int page;
    private int size;
    private Map<Long, List<SugestaoClassificacaoResponse>> sugestoes = new LinkedHashMap<>();
}
