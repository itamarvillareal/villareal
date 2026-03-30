package br.com.vilareal.pessoa.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Cliente para tela de Processos (GET /api/clientes)")
public class ClienteListItemResponse {

    private Long id;
    private String codigoCliente;
    private String nome;
    /** CPF/CNPJ só dígitos — paridade com {@code clientesRepository.mapApiToFront}. */
    private String documentoReferencia;

    public ClienteListItemResponse() {}

    public ClienteListItemResponse(Long id, String codigoCliente, String nome) {
        this(id, codigoCliente, nome, null);
    }

    public ClienteListItemResponse(Long id, String codigoCliente, String nome, String documentoReferencia) {
        this.id = id;
        this.codigoCliente = codigoCliente;
        this.nome = nome;
        this.documentoReferencia = documentoReferencia;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    /** Alias JSON para o front ({@code id} é sempre o {@code pessoa.id}). */
    public Long getPessoaId() {
        return id;
    }

    /** Alias JSON para o front. */
    public String getNomeReferencia() {
        return nome;
    }
}
