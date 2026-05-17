package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.TipoParCompensacao;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class AutoParearDetalheResponse {

    private ResumoLancamentoParResponse lancamentoA;
    private ResumoLancamentoParResponse lancamentoB;
    private TipoParCompensacao tipo;
}
