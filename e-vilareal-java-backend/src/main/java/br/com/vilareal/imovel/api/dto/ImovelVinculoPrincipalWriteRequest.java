package br.com.vilareal.imovel.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Define o par Cod.+Proc. principal (vínculo atual) do imóvel na planilha")
public class ImovelVinculoPrincipalWriteRequest {

    @NotBlank
    private String codigoCliente;

    @NotNull
    @Min(1)
    private Integer numeroInterno;

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
}
