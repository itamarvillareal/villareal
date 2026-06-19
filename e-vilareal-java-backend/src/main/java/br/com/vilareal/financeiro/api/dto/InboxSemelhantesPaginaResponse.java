package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class InboxSemelhantesPaginaResponse {

    private List<SemelhanteEscritorioGrupoResponse> content = new ArrayList<>();
    private long totalElements;
    private int totalPages;
    private int page;
    private int size;
    /** Total de lançamentos pendentes com sugestão (itens acionáveis). */
    private long totalItensAcionaveis;
}
