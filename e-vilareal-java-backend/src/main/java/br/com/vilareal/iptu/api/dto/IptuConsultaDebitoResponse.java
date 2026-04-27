package br.com.vilareal.iptu.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public class IptuConsultaDebitoResponse {

    private Long id;
    private Long imovelId;
    private LocalDate dataConsulta;
    private boolean existeDebito;
    private BigDecimal valorDebito;
    private String observacoes;
    private String anexoPath;
    private Long criadoPorUsuarioId;
    private Instant createdAt;

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

    public LocalDate getDataConsulta() {
        return dataConsulta;
    }

    public void setDataConsulta(LocalDate dataConsulta) {
        this.dataConsulta = dataConsulta;
    }

    public boolean isExisteDebito() {
        return existeDebito;
    }

    public void setExisteDebito(boolean existeDebito) {
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

    public Long getCriadoPorUsuarioId() {
        return criadoPorUsuarioId;
    }

    public void setCriadoPorUsuarioId(Long criadoPorUsuarioId) {
        this.criadoPorUsuarioId = criadoPorUsuarioId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
