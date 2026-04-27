package br.com.vilareal.iptu.api.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;

import java.math.BigDecimal;
import java.time.LocalDate;

public class IptuConsultaDebitoWriteRequest {

    @NotNull
    private Long imovelId;

    @NotNull
    @PastOrPresent
    private LocalDate dataConsulta;

    @NotNull
    private Boolean existeDebito;

    private BigDecimal valorDebito;

    private String observacoes;

    private String anexoPath;

    public Long getImovelId() {
        return imovelId;
    }

    public void setImovelId(Long imovelId) {
        this.imovelId = imovelId;
    }

    public LocalDate getDataConsulta() {
        return dataConsulta;
    }

    public void setDataConsulta(LocalDate dataConsulta) {
        this.dataConsulta = dataConsulta;
    }

    public Boolean getExisteDebito() {
        return existeDebito;
    }

    public void setExisteDebito(Boolean existeDebito) {
        this.existeDebito = existeDebito;
    }

    public BigDecimal getValorDebito() {
        return valorDebito;
    }

    public void setValorDebito(BigDecimal valorDebito) {
        this.valorDebito = valorDebito;
    }

    public String getObservacoes() {
        return observacoes;
    }

    public void setObservacoes(String observacoes) {
        this.observacoes = observacoes;
    }

    public String getAnexoPath() {
        return anexoPath;
    }

    public void setAnexoPath(String anexoPath) {
        this.anexoPath = anexoPath;
    }
}
