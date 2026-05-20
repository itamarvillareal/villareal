package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.financeiro.domain.TipoParCompensacao;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ParCompensacaoSugeridoResponse {

    private ResumoLancamentoParResponse lancamentoA;
    private ResumoLancamentoParResponse lancamentoB;
    private TipoParCompensacao tipo;
    private ConfiancaSugestao confianca;
}
