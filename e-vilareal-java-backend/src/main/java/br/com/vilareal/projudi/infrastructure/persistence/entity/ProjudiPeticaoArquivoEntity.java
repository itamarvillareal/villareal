package br.com.vilareal.projudi.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "projudi_peticao_arquivo")
@Getter
@Setter
public class ProjudiPeticaoArquivoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "peticao_id", nullable = false)
    private ProjudiPeticaoEntity peticao;

    @Column(nullable = false)
    private int ordem;

    @Column(name = "id_arquivo_tipo", nullable = false)
    private int idArquivoTipo;

    @Column(name = "nome_original", length = 255)
    private String nomeOriginal;

    @Column(name = "pdf_sha256", columnDefinition = "CHAR(64)", nullable = false)
    private String pdfSha256;

    @Column(name = "pdf_ref", length = 500, nullable = false)
    private String pdfRef;

    @Column(name = "drive_file_id", length = 120)
    private String driveFileId;

    @Column(name = "p7s_drive_file_id", length = 120)
    private String p7sDriveFileId;

    @Column(name = "p7s_sha256", columnDefinition = "CHAR(64)")
    private String p7sSha256;

    @Column(name = "conteudo_assinado_sha256", columnDefinition = "CHAR(64)")
    private String conteudoAssinadoSha256;

    @Column(name = "p7s_ref", length = 500)
    private String p7sRef;

    @Column(length = 30, nullable = false)
    private String status = "PENDENTE_ASSINATURA";

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;
}
