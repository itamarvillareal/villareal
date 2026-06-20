package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class LancamentoCartaoResponse {
    private Long id;
    private Long cartaoId;
    private String cartaoNome;
    private Integer numeroCartao;
    private Long contaContabilId;
    private String contaContabilNome;
    private Long clienteId;
    private Long pessoaRefId;
    private Long processoId;
    private String codigoCliente;
    private Integer numeroInternoProcesso;
    private String numeroLancamento;
    private LocalDate dataLancamento;
    private LocalDate dataCompetencia;
    private String descricao;
    private String descricaoDetalhada;
    /** Valor com sinal da fatura. */
    private BigDecimal valor;
    private String refTipo;
    private String origem;
    private String status;
    private String etapa;
    private String grupoCompensacao;
}
