package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Projeção enxuta para grade do extrato (sem serialização pesada da listagem completa). */
@Getter
@Setter
public class LancamentoExtratoListItemResponse {

    private Long id;
    private Long contaContabilId;
    private String contaContabilNome;
    private Long clienteId;
    private Long pessoaRefId;
    private Long processoId;
    private String codigoCliente;
    private Integer numeroInternoProcesso;
    private String bancoNome;
    private Integer numeroBanco;
    private String numeroLancamento;
    private LocalDate dataLancamento;
    private String descricao;
    private String descricaoDetalhada;
    private BigDecimal valor;
    private NaturezaLancamento natureza;
    private String refTipo;
    private String origem;
    private String etapa;
    private String grupoCompensacao;
    /** Visão do cliente (CONTA ZERO): FALSE omite do relatório de acerto do cliente. */
    private Boolean visivelCliente;
    /** Visão do cliente (CONTA ZERO): valor alternativo no relatório do cliente (null = valor real). */
    private BigDecimal valorCliente;
    /** Conferência do acerto (V205): null = pendente de conferência. */
    private java.time.Instant conferidoEm;
    private String conferidoPorNome;
}
