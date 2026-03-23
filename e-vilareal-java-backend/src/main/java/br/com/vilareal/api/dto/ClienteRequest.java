package br.com.vilareal.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ClienteRequest {
    @NotBlank
    @Size(max = 8)
    private String codigoCliente;

    private Long pessoaId;

    @NotBlank
    @Size(max = 255)
    private String nomeReferencia;

    @Size(max = 20)
    private String documentoReferencia;

    private String observacao;
    private Boolean inativo;

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
}
