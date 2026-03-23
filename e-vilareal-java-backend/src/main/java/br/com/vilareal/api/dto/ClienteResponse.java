package br.com.vilareal.api.dto;

import java.time.LocalDateTime;

public class ClienteResponse {
    private Long id;
    private String codigoCliente;
    private Long pessoaId;
    private String nomeReferencia;
    private String documentoReferencia;
    private String observacao;
    private Boolean inativo;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCodigoCliente() { return codigoCliente; }
    public void setCodigoCliente(String codigoCliente) { this.codigoCliente = codigoCliente; }
    public Long getPessoaId() { return pessoaId; }
    public void setPessoaId(Long pessoaId) { this.pessoaId = pessoaId; }
    public String getNomeReferencia() { return nomeReferencia; }
    public void setNomeReferencia(String nomeReferencia) { this.nomeReferencia = nomeReferencia; }
    public String getDocumentoReferencia() { return documentoReferencia; }
    public void setDocumentoReferencia(String documentoReferencia) { this.documentoReferencia = documentoReferencia; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String observacao) { this.observacao = observacao; }
    public Boolean getInativo() { return inativo; }
    public void setInativo(Boolean inativo) { this.inativo = inativo; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
