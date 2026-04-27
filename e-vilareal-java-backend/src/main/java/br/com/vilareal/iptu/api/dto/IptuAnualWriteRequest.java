package br.com.vilareal.iptu.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

@Schema(description = "Create or update annual IPTU configuration")
public class IptuAnualWriteRequest {

    @NotNull
    private Long imovelId;

    @NotNull
    @Min(2000)
    @Max(2100)
    private Integer anoReferencia;

    @NotNull
    @DecimalMin(value = "0.0", inclusive = true)
    private BigDecimal valorTotalAnual;

    @Min(1)
    @Max(31)
    private Integer diasMesDivisor = 30;

    private String observacoes;

    private String anexoCarnePath;

    public Long getImovelId() {
        return imovelId;
    }

    public void setImovelId(Long imovelId) {
        this.imovelId = imovelId;
    }

    public Integer getAnoReferencia() {
        return anoReferencia;
    }

    public void setAnoReferencia(Integer anoReferencia) {
        this.anoReferencia = anoReferencia;
    }

    public BigDecimal getValorTotalAnual() {
        return valorTotalAnual;
    }

    public void setValorTotalAnual(BigDecimal valorTotalAnual) {
        this.valorTotalAnual = valorTotalAnual;
    }

    public Integer getDiasMesDivisor() {
        return diasMesDivisor;
    }

    public void setDiasMesDivisor(Integer diasMesDivisor) {
        this.diasMesDivisor = diasMesDivisor;
    }

    public String getObservacoes() {
        return observacoes;
    }

    public void setObservacoes(String observacoes) {
        this.observacoes = observacoes;
    }

    public String getAnexoCarnePath() {
        return anexoCarnePath;
    }

    public void setAnexoCarnePath(String anexoCarnePath) {
        this.anexoCarnePath = anexoCarnePath;
    }
}
