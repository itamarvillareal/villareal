package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class LancamentoFinanceiroResponse {

    private Long id;
    private Long contaContabilId;
    private String contaContabilNome;
    private Long clienteId;
    private Long processoId;
    private String bancoNome;
    private Integer numeroBanco;
    private String numeroLancamento;
    private LocalDate dataLancamento;
    private String descricao;
    private String descricaoDetalhada;
    private BigDecimal valor;
    private NaturezaLancamento natureza;
    private String refTipo;
    private String eqReferencia;
    private String parcelaRef;
    private String origem;
    private String status;
    private Long classificacaoFinanceiraId;
    private Long eloFinanceiroId;
}
