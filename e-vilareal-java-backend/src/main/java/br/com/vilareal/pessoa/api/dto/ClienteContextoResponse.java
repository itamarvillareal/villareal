package br.com.vilareal.pessoa.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Cabeçalho do cliente + metadados para abertura rápida do formulário")
public class ClienteContextoResponse {

    private ClienteListItemResponse cliente;
    private long totalProcessos;

    public ClienteContextoResponse() {}

    public ClienteContextoResponse(ClienteListItemResponse cliente, long totalProcessos) {
        this.cliente = cliente;
        this.totalProcessos = totalProcessos;
    }

    public ClienteListItemResponse getCliente() {
        return cliente;
    }

    public void setCliente(ClienteListItemResponse cliente) {
        this.cliente = cliente;
    }

    public long getTotalProcessos() {
        return totalProcessos;
    }

    public void setTotalProcessos(long totalProcessos) {
        this.totalProcessos = totalProcessos;
    }
}
