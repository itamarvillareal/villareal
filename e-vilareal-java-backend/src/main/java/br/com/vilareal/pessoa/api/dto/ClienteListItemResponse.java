package br.com.vilareal.pessoa.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Cliente para tela de Processos (GET /api/clientes)")
public class ClienteListItemResponse {

    /**
     * PK da tabela {@code cliente}. Ausente quando o item veio só do import Pasta1 sem linha em {@code cliente}.
     */
    private Long clienteId;

    /** {@code pessoa.id} do vínculo — não confundir com {@link #clienteId}. */
    private Long pessoaId;

    private String codigoCliente;
    private String nome;
    /** CPF/CNPJ só dígitos — paridade com {@code clientesRepository.mapApiToFront}. */
    private String documentoReferencia;

    public ClienteListItemResponse() {}

    /** Item canónico (tabela {@code cliente} + pessoa). */
    public ClienteListItemResponse(
            Long clienteId, Long pessoaId, String codigoCliente, String nome, String documentoReferencia) {
        this.clienteId = clienteId;
        this.pessoaId = pessoaId;
        this.codigoCliente = codigoCliente;
        this.nome = nome;
        this.documentoReferencia = documentoReferencia;
    }

    @Schema(description = "PK da tabela cliente; igual a clienteId quando houver registro em cliente")
    public Long getId() {
        return clienteId;
    }

    public void setId(Long id) {
        this.clienteId = id;
    }

    public Long getClienteId() {
        return clienteId;
    }

    public void setClienteId(Long clienteId) {
        this.clienteId = clienteId;
    }

    public Long getPessoaId() {
        return pessoaId;
    }

    public void setPessoaId(Long pessoaId) {
        this.pessoaId = pessoaId;
    }

    public String getCodigoCliente() {
        return codigoCliente;
    }

    public void setCodigoCliente(String codigoCliente) {
        this.codigoCliente = codigoCliente;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getDocumentoReferencia() {
        return documentoReferencia;
    }

    public void setDocumentoReferencia(String documentoReferencia) {
        this.documentoReferencia = documentoReferencia;
    }

    /** Alias JSON para o front. */
    public String getNomeReferencia() {
        return nome;
    }
}
