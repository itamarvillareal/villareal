package br.com.vilareal.imovel.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class ImovelVinculoLocatarioWriteRequest {

    @NotBlank
    private String codigoCliente;

    @NotNull
    private Integer numeroInterno;

    private Long processoId;
    private String camposExtrasJson;

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

    public Long getProcessoId() {
        return processoId;
    }

    public void setProcessoId(Long processoId) {
        this.processoId = processoId;
    }

    public String getCamposExtrasJson() {
        return camposExtrasJson;
    }

    public void setCamposExtrasJson(String camposExtrasJson) {
        this.camposExtrasJson = camposExtrasJson;
    }
}
