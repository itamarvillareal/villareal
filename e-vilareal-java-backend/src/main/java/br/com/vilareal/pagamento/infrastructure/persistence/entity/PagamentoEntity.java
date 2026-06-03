package br.com.vilareal.pagamento.infrastructure.persistence.entity;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "pagamento")
@Getter
@Setter
public class PagamentoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 10)
    private String tipo = PagamentoDominio.TIPO_PAGAR;

    @Column(name = "data_cadastro", nullable = false)
    private LocalDate dataCadastro;

    @Column(name = "data_emissao")
    private LocalDate dataEmissao;

    @Column(name = "data_agendamento")
    private LocalDate dataAgendamento;

    @Column(name = "data_vencimento", nullable = false)
    private LocalDate dataVencimento;

    @Column(name = "codigo_barras", length = 180)
    private String codigoBarras;

    @Column(precision = 19, scale = 2)
    private BigDecimal valor;

    @Column(nullable = false, length = 500)
    private String descricao;

    @Column(nullable = false, length = 40)
    private String categoria;

    @Column(name = "forma_pagamento", nullable = false, length = 40)
    private String formaPagamento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responsavel_usuario_id")
    private UsuarioEntity responsavelUsuario;

    @Column(nullable = false, length = 40)
    private String status;

    @Column(nullable = false, length = 24)
    private String prioridade = "NORMAL";

    @Column(length = 120)
    private String origem;

    @Column(name = "data_pagamento_efetivo")
    private LocalDate dataPagamentoEfetivo;

    @Column(name = "data_recebimento")
    private LocalDate dataRecebimento;

    @Column(columnDefinition = "TEXT")
    private String observacoes;

    @Column(name = "boleto_arquivo_path", length = 500)
    private String boletoArquivoPath;

    @Column(name = "comprovante_arquivo_path", length = 500)
    private String comprovanteArquivoPath;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "financeiro_lancamento_id")
    private LancamentoFinanceiroEntity financeiroLancamento;

    @Column(name = "data_conferencia")
    private LocalDate dataConferencia;

    @Column(name = "data_acerto")
    private LocalDate dataAcerto;

    @Column(name = "valor_pago_banco", precision = 19, scale = 2)
    private BigDecimal valorPagoBanco;

    @Column(name = "valor_recebido", precision = 19, scale = 2)
    private BigDecimal valorRecebido;

    @Column(name = "valor_diferenca", precision = 19, scale = 2)
    private BigDecimal valorDiferenca;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conferido_por_usuario_id")
    private UsuarioEntity conferidoPorUsuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prestacao_contas_id")
    private PrestacaoContasEntity prestacaoContas;

    @Column(name = "mes_referencia", length = 7)
    private String mesReferencia;

    @Column(name = "conta_referencia", length = 50)
    private String contaReferencia;

    @Column(name = "auto_gerado", nullable = false)
    private Boolean autoGerado = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recorrencia_config_id")
    private PagamentoRecorrenciaConfigEntity recorrenciaConfig;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id")
    private ClienteEntity cliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processo_id")
    private ProcessoEntity processo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "imovel_id")
    private ImovelEntity imovel;

    @Column(name = "condominio_texto", length = 255)
    private String condominioTexto;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrato_locacao_id")
    private ContratoLocacaoEntity contratoLocacao;

    @Column(name = "fornecedor_texto", length = 255)
    private String fornecedorTexto;

    @Column(nullable = false)
    private Boolean recorrente = false;

    @Column(name = "recorrencia_tipo", length = 20)
    private String recorrenciaTipo;

    @Column(name = "recorrencia_quantidade_parcelas")
    private Integer recorrenciaQuantidadeParcelas;

    @Column(name = "recorrencia_parcela_atual")
    private Integer recorrenciaParcelaAtual;

    @Column(name = "recorrencia_valor_fixo")
    private Boolean recorrenciaValorFixo;

    @Column(name = "recorrencia_descricao_padrao", length = 500)
    private String recorrenciaDescricaoPadrao;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recorrencia_pagamento_origem_id")
    private PagamentoEntity recorrenciaPagamentoOrigem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "substituido_por_pagamento_id")
    private PagamentoEntity substituidoPorPagamento;

    @Column(name = "cancelado_em")
    private Instant canceladoEm;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "criado_por_usuario_id", nullable = false)
    private UsuarioEntity criadoPorUsuario;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "atualizado_por_usuario_id")
    private UsuarioEntity atualizadoPorUsuario;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", insertable = false, updatable = false)
    private Instant atualizadoEm;
}
