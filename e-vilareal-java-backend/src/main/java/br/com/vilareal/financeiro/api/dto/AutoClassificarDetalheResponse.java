package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.financeiro.domain.OrigemSugestao;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AutoClassificarDetalheResponse {

    private Long lancamentoId;
    private String descricao;
    private String sugestao;
    private ConfiancaSugestao confianca;
    private OrigemSugestao origem;
}
