package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class ResumoLancamentoParResponse {

    private Long id;
    private String banco;
    private String descricao;
    private BigDecimal valor;
    private NaturezaLancamento natureza;
}
