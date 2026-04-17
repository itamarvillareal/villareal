package br.com.vilareal.publicacao.infrastructure.persistence.entity;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "publicacoes")
@Getter
@Setter
public class PublicacaoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "numero_processo_encontrado", nullable = false, length = 120)
    private String numeroProcessoEncontrado;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processo_id")
    private ProcessoEntity processo;

    /**
     * Mesma semântica de {@code ProcessoResponse.clienteId}: id da pessoa titular (não FK obrigatória à tabela {@code cliente}).
     */
    @Column(name = "cliente_ref_id")
    private Long clienteRefId;

    @Column(name = "data_disponibilizacao")
    private LocalDate dataDisponibilizacao;

    @Column(name = "data_publicacao")
    private LocalDate dataPublicacao;

    @Column(length = 120)
    private String fonte;

    @Column(length = 200)
    private String diario;

    @Column(length = 255)
    private String titulo;

    @Column(name = "tipo_publicacao", length = 80)
    private String tipoPublicacao;

    @Column(columnDefinition = "TEXT")
    private String resumo;

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String teor;

    @Column(name = "status_validacao_cnj", length = 40)
    private String statusValidacaoCnj;

    @Column(name = "score_confianca", length = 16)
    private String scoreConfianca;

    @Column(name = "hash_teor", nullable = false, length = 128)
    private String hashTeor = "";

    @Column(name = "hash_conteudo", nullable = false, length = 128, unique = true)
    private String hashConteudo;

    @Column(name = "origem_importacao", nullable = false, length = 40)
    private String origemImportacao = "MANUAL";

    @Column(name = "arquivo_origem_nome", length = 255)
    private String arquivoOrigemNome;

    @Column(name = "arquivo_origem_hash", length = 128)
    private String arquivoOrigemHash;

    @Column(name = "json_referencia", columnDefinition = "LONGTEXT")
    private String jsonReferencia;

    @Column(name = "status_tratamento", nullable = false, length = 30)
    private String statusTratamento = "PENDENTE";

    @Column(nullable = false)
    private boolean lida;

    @Column(columnDefinition = "TEXT")
    private String observacao;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
