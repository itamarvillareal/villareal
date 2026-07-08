package br.com.vilareal.documento.importacao.infrastructure.persistence.entity;

import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosEntity;
import br.com.vilareal.mensalista.infrastructure.persistence.entity.MensalistaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "contrato_honorarios_importacao")
@Getter
@Setter
public class ContratoHonorariosImportacaoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "importacao_lote_id", nullable = false, length = 36)
    private String importacaoLoteId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id")
    private ClienteEntity cliente;

    @Column(name = "codigo_cliente", columnDefinition = "CHAR(8)")
    private String codigoCliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processo_id")
    private ProcessoEntity processo;

    @Column(name = "processo_stub_criado", nullable = false)
    private Boolean processoStubCriado = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pessoa_id")
    private PessoaEntity pessoa;

    @Column(name = "pdf_drive_file_id", length = 128)
    private String pdfDriveFileId;

    @Column(name = "pdf_nome_arquivo", length = 255)
    private String pdfNomeArquivo;

    @Column(name = "hash_pdf", nullable = false, length = 64)
    private String hashPdf;

    @Column(name = "hash_pdf_ativo", length = 64)
    private String hashPdfAtivo;

    @Column(name = "clausula_extraida_texto", columnDefinition = "TEXT")
    private String clausulaExtraidaTexto;

    @Column(name = "dados_extraidos_json", columnDefinition = "LONGTEXT")
    private String dadosExtraidosJson;

    @Column(name = "dados_aprovados_json", columnDefinition = "LONGTEXT")
    private String dadosAprovadosJson;

    @Column(name = "score_confianca", precision = 5, scale = 2)
    private BigDecimal scoreConfianca;

    @Column(name = "alertas_json", columnDefinition = "LONGTEXT")
    private String alertasJson;

    @Column(name = "roteamento_tipo", length = 20)
    private String roteamentoTipo;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrato_honorarios_id")
    private ContratoHonorariosEntity contratoHonorarios;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mensalista_id")
    private MensalistaEntity mensalista;

    @Column(name = "conciliacao_json", columnDefinition = "LONGTEXT")
    private String conciliacaoJson;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "criado_por_usuario_id")
    private UsuarioEntity criadoPorUsuario;

    @Column(name = "criado_em", nullable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em")
    private Instant atualizadoEm;

    @Column(name = "aprovado_em")
    private Instant aprovadoEm;

    @Column(name = "revertido_em")
    private Instant revertidoEm;
}
