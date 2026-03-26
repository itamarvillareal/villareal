package br.com.vilareal.pessoa.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Cliente para tela de Processos (GET /api/clientes)")
public class ClienteListItemResponse {

    private Long id;
    private String codigoCliente;
    private String nome;

    public ClienteListItemResponse() {}

    public ClienteListItemResponse(Long id, String codigoCliente, String nome) {
        this.id = id;
        this.codigoCliente = codigoCliente;
        this.nome = nome;
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
}
