package br.com.vilareal.pessoa.infrastructure.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "pessoa_documento_drive")
public class PessoaDocumentoDriveEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "pessoa_id", nullable = false)
    private Long pessoaId;

    @Column(name = "tipo", nullable = false, length = 40)
    private String tipo;

    @Column(name = "nome_arquivo", nullable = false, length = 500)
    private String nomeArquivo;

    @Column(name = "drive_file_id", length = 120)
    private String driveFileId;

    @Column(name = "p7s_drive_file_id", length = 120)
    private String p7sDriveFileId;

    @Column(name = "pdf_sha256", columnDefinition = "CHAR(64)")
    private String pdfSha256;

    @Column(name = "p7s_sha256", columnDefinition = "CHAR(64)")
    private String p7sSha256;

    @Column(name = "mime_type", length = 120)
    private String mimeType;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getPessoaId() {
        return pessoaId;
    }

    public void setPessoaId(Long pessoaId) {
        this.pessoaId = pessoaId;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public String getNomeArquivo() {
        return nomeArquivo;
    }

    public void setNomeArquivo(String nomeArquivo) {
        this.nomeArquivo = nomeArquivo;
    }

    public String getDriveFileId() {
        return driveFileId;
    }

    public void setDriveFileId(String driveFileId) {
        this.driveFileId = driveFileId;
    }

    public String getP7sDriveFileId() {
        return p7sDriveFileId;
    }

    public void setP7sDriveFileId(String p7sDriveFileId) {
        this.p7sDriveFileId = p7sDriveFileId;
    }

    public String getPdfSha256() {
        return pdfSha256;
    }

    public void setPdfSha256(String pdfSha256) {
        this.pdfSha256 = pdfSha256;
    }

    public String getP7sSha256() {
        return p7sSha256;
    }

    public void setP7sSha256(String p7sSha256) {
        this.p7sSha256 = p7sSha256;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
