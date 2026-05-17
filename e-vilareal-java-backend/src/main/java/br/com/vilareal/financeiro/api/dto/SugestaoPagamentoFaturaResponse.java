package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class SugestaoPagamentoFaturaResponse {
    private LancamentoFinanceiroResponse lancamentoBanco;
    private LancamentoCartaoResponse lancamentoCartao;
    private BigDecimal diferencaValor;
    private Integer diasDiferenca;
    private ConfiancaSugestao confianca;
    private Long regraId;
    private String descricaoRegra;
}
