package br.com.vilareal.iptu.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public class IptuParcelaResponse {

    private Long id;
    private Long iptuAnualId;
    private Long contratoLocacaoId;
    private String competenciaMes;
    private Integer diasCobrados;
    private boolean mesCompleto;
    private BigDecimal valorCalculado;
    private String status;
    private LocalDate dataVencimento;
    private LocalDate dataPagamento;
    private Long pagamentoId;
    private String observacoes;
    private Instant createdAt;
    private Instant updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getIptuAnualId() {
        return iptuAnualId;
    }

    public void setIptuAnualId(Long iptuAnualId) {
        this.iptuAnualId = iptuAnualId;
    }

    public Long getContratoLocacaoId() {
        return contratoLocacaoId;
    }

    public void setContratoLocacaoId(Long contratoLocacaoId) {
        this.contratoLocacaoId = contratoLocacaoId;
    }

    public String getCompetenciaMes() {
        return competenciaMes;
    }

    public void setCompetenciaMes(String competenciaMes) {
        this.competenciaMes = competenciaMes;
    }

    public Integer getDiasCobrados() {
        return diasCobrados;
    }

    public void setDiasCobrados(Integer diasCobrados) {
        this.diasCobrados = diasCobrados;
    }

    public boolean isMesCompleto() {
        return mesCompleto;
    }

    public void setMesCompleto(boolean mesCompleto) {
        this.mesCompleto = mesCompleto;
    }

    public BigDecimal getValorCalculado() {
        return valorCalculado;
    }

    public void setValorCalculado(BigDecimal valorCalculado) {
        this.valorCalculado = valorCalculado;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDate getDataVencimento() {
        return dataVencimento;
    }

    public void setDataVencimento(LocalDate dataVencimento) {
        this.dataVencimento = dataVencimento;
    }

    public LocalDate getDataPagamento() {
        return dataPagamento;
    }

    public void setDataPagamento(LocalDate dataPagamento) {
        this.dataPagamento = dataPagamento;
    }

    public Long getPagamentoId() {
        return pagamentoId;
    }

    public void setPagamentoId(Long pagamentoId) {
        this.pagamentoId = pagamentoId;
    }

    public String getObservacoes() {
        return observacoes;
    }

    public void setObservacoes(String observacoes) {
        this.observacoes = observacoes;
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
