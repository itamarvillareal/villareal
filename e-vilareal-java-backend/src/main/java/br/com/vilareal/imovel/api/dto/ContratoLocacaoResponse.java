package br.com.vilareal.imovel.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public class ContratoLocacaoResponse {

    private Long id;
    private Long imovelId;
    private Long locadorPessoaId;
    private Long inquilinoPessoaId;
    private LocalDate dataInicio;
    private LocalDate dataFim;
    private BigDecimal valorAluguel;
    private BigDecimal valorRepassePactuado;
    private Integer diaVencimentoAluguel;
    private Integer diaRepasse;
    private String garantiaTipo;
    private BigDecimal valorGarantia;
    private String dadosBancariosRepasseJson;
    private String status;
    private String observacoes;

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

    public Long getLocadorPessoaId() {
        return locadorPessoaId;
    }

    public void setLocadorPessoaId(Long locadorPessoaId) {
        this.locadorPessoaId = locadorPessoaId;
    }

    public Long getInquilinoPessoaId() {
        return inquilinoPessoaId;
    }

    public void setInquilinoPessoaId(Long inquilinoPessoaId) {
        this.inquilinoPessoaId = inquilinoPessoaId;
    }

    public LocalDate getDataInicio() {
        return dataInicio;
    }

    public void setDataInicio(LocalDate dataInicio) {
        this.dataInicio = dataInicio;
    }

    public LocalDate getDataFim() {
        return dataFim;
    }

    public void setDataFim(LocalDate dataFim) {
        this.dataFim = dataFim;
    }

    public BigDecimal getValorAluguel() {
        return valorAluguel;
    }

    public void setValorAluguel(BigDecimal valorAluguel) {
        this.valorAluguel = valorAluguel;
    }

    public BigDecimal getValorRepassePactuado() {
        return valorRepassePactuado;
    }

    public void setValorRepassePactuado(BigDecimal valorRepassePactuado) {
        this.valorRepassePactuado = valorRepassePactuado;
    }

    public Integer getDiaVencimentoAluguel() {
        return diaVencimentoAluguel;
    }

    public void setDiaVencimentoAluguel(Integer diaVencimentoAluguel) {
        this.diaVencimentoAluguel = diaVencimentoAluguel;
    }

    public Integer getDiaRepasse() {
        return diaRepasse;
    }

    public void setDiaRepasse(Integer diaRepasse) {
        this.diaRepasse = diaRepasse;
    }

    public String getGarantiaTipo() {
        return garantiaTipo;
    }

    public void setGarantiaTipo(String garantiaTipo) {
        this.garantiaTipo = garantiaTipo;
    }

    public BigDecimal getValorGarantia() {
        return valorGarantia;
    }

    public void setValorGarantia(BigDecimal valorGarantia) {
        this.valorGarantia = valorGarantia;
    }

    public String getDadosBancariosRepasseJson() {
        return dadosBancariosRepasseJson;
    }

    public void setDadosBancariosRepasseJson(String dadosBancariosRepasseJson) {
        this.dadosBancariosRepasseJson = dadosBancariosRepasseJson;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getObservacoes() {
        return observacoes;
    }

    public void setObservacoes(String observacoes) {
        this.observacoes = observacoes;
    }
}
