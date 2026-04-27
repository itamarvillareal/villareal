package br.com.vilareal.iptu.api.dto;

import java.math.BigDecimal;
import java.time.Instant;

public class IptuAnualResponse {

    private Long id;
    private Long imovelId;
    private Integer anoReferencia;
    private BigDecimal valorTotalAnual;
    private Integer diasMesDivisor;
    private String observacoes;
    private String anexoCarnePath;
    private Instant createdAt;
    private Instant updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
