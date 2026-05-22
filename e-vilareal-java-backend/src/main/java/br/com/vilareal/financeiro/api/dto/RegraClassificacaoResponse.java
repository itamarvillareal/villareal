package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.TipoMatch;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class RegraClassificacaoResponse {

    private Long id;
    private String padraoDescricao;
    private TipoMatch tipoMatch;
    private Long contaContabilId;
    private String contaContabilCodigo;
    private String contaContabilNome;
    private String letraDestino;
    private Integer numeroBanco;
    private Integer prioridade;
    private BigDecimal confianca;
    private Boolean ativo;
    private Long clienteId;
    private Long pessoaRefId;
    private Long processoId;
}
