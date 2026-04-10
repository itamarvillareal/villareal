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
    /** Código do cliente (8 dígitos), derivado da pessoa — para exibição no extrato (não confundir com {@link #clienteId}). */
    private String codigoCliente;
    /** Nº interno do processo no cadastro do cliente — para exibição no extrato (não confundir com {@link #processoId}). */
    private Integer numeroInternoProcesso;
    private String bancoNome;
    private Integer numeroBanco;
    private String numeroLancamento;
    private LocalDate dataLancamento;
    /** Competência contábil (coluna {@code data_competencia}); pode coincidir com {@link #dataLancamento}. */
    private LocalDate dataCompetencia;
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
