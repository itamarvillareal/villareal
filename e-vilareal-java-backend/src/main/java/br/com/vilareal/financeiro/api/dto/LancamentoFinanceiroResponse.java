package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import io.swagger.v3.oas.annotations.media.Schema;
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
    @Schema(description = "PK da tabela cliente")
    private Long clienteId;
    @Schema(description = "pessoa.id referenciada no lançamento (legado; antes exposto como clienteId)")
    private Long pessoaRefId;
    private Long processoId;
    /** Código do cliente (8 dígitos) — para exibição no extrato (não confundir com {@link #clienteId}). */
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
    private String origem;
    private String status;
    /** Etapa do workflow: IMPORTADO, CLASSIFICADO, COMPENSADO, VINCULADO, FECHADO. */
    private String etapa;
    /** Par de compensação (col. M / Elo). */
    private String grupoCompensacao;
}
