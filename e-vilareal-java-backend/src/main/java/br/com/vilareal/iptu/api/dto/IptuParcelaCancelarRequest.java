package br.com.vilareal.iptu.api.dto;

import jakarta.validation.constraints.NotBlank;

public class IptuParcelaCancelarRequest {

    @NotBlank
    private String motivo;

    public String getMotivo() {
        return motivo;
    }

    public void setMotivo(String motivo) {
        this.motivo = motivo;
    }
}
