package br.com.vilareal.processo.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class DiagnosticoAguardandoProtocoloItemRequest {

    @NotBlank
    private String codigoCliente;

    @NotNull
    private Integer numeroInterno;

    private String numeroProcessoNovo;

    public String getCodigoCliente() {
        return codigoCliente;
    }

    public void setCodigoCliente(String codigoCliente) {
        this.codigoCliente = codigoCliente;
    }

    public Integer getNumeroInterno() {
        return numeroInterno;
    }

    public void setNumeroInterno(Integer numeroInterno) {
        this.numeroInterno = numeroInterno;
    }

    public String getNumeroProcessoNovo() {
        return numeroProcessoNovo;
    }

    public void setNumeroProcessoNovo(String numeroProcessoNovo) {
        this.numeroProcessoNovo = numeroProcessoNovo;
    }
}
