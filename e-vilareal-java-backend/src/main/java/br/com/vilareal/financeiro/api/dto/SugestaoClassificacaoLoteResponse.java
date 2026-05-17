package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
public class SugestaoClassificacaoLoteResponse {

    private Map<Long, List<SugestaoClassificacaoResponse>> sugestoes;
}
