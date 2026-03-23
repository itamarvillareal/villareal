package br.com.vilareal.api.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "clientes", indexes = {
        @Index(name = "idx_clientes_pessoa_id", columnList = "pessoa_id"),
        @Index(name = "idx_clientes_inativo", columnList = "inativo"),
        @Index(name = "idx_clientes_nome_referencia", columnList = "nome_referencia")
})
public class Cliente {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "codigo_cliente", nullable = false, unique = true, length = 8)
    private String codigoCliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pessoa_id", foreignKey = @ForeignKey(name = "fk_clientes_pessoa"))
    private CadastroPessoa pessoa;

    @Column(name = "nome_referencia", nullable = false, length = 255)
    private String nomeReferencia;

    @Column(name = "documento_referencia", length = 20)
    private String documentoReferencia;

    @Column(columnDefinition = "TEXT")
    private String observacao;

    @Column(nullable = false)
    private Boolean inativo = false;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCodigoCliente() { return codigoCliente; }
    public void setCodigoCliente(String codigoCliente) { this.codigoCliente = codigoCliente; }
    public CadastroPessoa getPessoa() { return pessoa; }
    public void setPessoa(CadastroPessoa pessoa) { this.pessoa = pessoa; }
    public String getNomeReferencia() { return nomeReferencia; }
    public void setNomeReferencia(String nomeReferencia) { this.nomeReferencia = nomeReferencia; }
    public String getDocumentoReferencia() { return documentoReferencia; }
    public void setDocumentoReferencia(String documentoReferencia) { this.documentoReferencia = documentoReferencia; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String observacao) { this.observacao = observacao; }
    public Boolean getInativo() { return inativo; }
    public void setInativo(Boolean inativo) { this.inativo = inativo; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
