package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.TipoMatchFatura;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class CartaoBancoMapeamentoResponse {
    private Long id;
    private Long cartaoId;
    private String cartaoNome;
    private Integer numeroBanco;
    private String padraoDescricao;
    private TipoMatchFatura tipoMatch;
    private BigDecimal toleranciaValor;
    private Integer toleranciaDias;
    private Boolean ativo;
}
