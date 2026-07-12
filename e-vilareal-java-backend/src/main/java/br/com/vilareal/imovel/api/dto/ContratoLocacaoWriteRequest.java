package br.com.vilareal.imovel.api.dto;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public class ContratoLocacaoWriteRequest {

    @NotNull
    private Long imovelId;

    /** Par Cod.+Proc. — escopo do contrato/locatário. */
    private Long processoId;

    private Long locadorPessoaId;
    private Long inquilinoPessoaId;

    /** Obrigatório apenas na criação ({@link br.com.vilareal.imovel.application.ImovelApplicationService#criarContrato}). */
    private LocalDate dataInicio;

    private LocalDate dataFim;

    /** Obrigatório apenas na criação. */
    private BigDecimal valorAluguel;

    private BigDecimal valorRepassePactuado;
    private Integer diaVencimentoAluguel;
    /** {@code DEPOSITO_TED} ou {@code BOLETO}. */
    private String formaPagamentoAluguel;
    private Integer diaRepasse;
    private BigDecimal taxaAdministracaoPercent;
    private String garantiaTipo;
    private BigDecimal valorGarantia;
    private String dadosBancariosRepasseJson;
    private String status;
    private String observacoes;
    private List<Long> fiadoresPessoaIds;
    private List<Long> inquilinosPessoaIds;
    private Boolean agendarCobrancaWhatsApp;

    public Long getImovelId() {
        return imovelId;
    }

    public void setImovelId(Long imovelId) {
        this.imovelId = imovelId;
    }

    public Long getProcessoId() {
        return processoId;
    }

    public void setProcessoId(Long processoId) {
        this.processoId = processoId;
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

    public String getFormaPagamentoAluguel() {
        return formaPagamentoAluguel;
    }

    public void setFormaPagamentoAluguel(String formaPagamentoAluguel) {
        this.formaPagamentoAluguel = formaPagamentoAluguel;
    }

    public Integer getDiaRepasse() {
        return diaRepasse;
    }

    public void setDiaRepasse(Integer diaRepasse) {
        this.diaRepasse = diaRepasse;
    }

    public BigDecimal getTaxaAdministracaoPercent() {
        return taxaAdministracaoPercent;
    }

    public void setTaxaAdministracaoPercent(BigDecimal taxaAdministracaoPercent) {
        this.taxaAdministracaoPercent = taxaAdministracaoPercent;
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

    public List<Long> getFiadoresPessoaIds() {
        return fiadoresPessoaIds;
    }

    public void setFiadoresPessoaIds(List<Long> fiadoresPessoaIds) {
        this.fiadoresPessoaIds = fiadoresPessoaIds;
    }

    public List<Long> getInquilinosPessoaIds() {
        return inquilinosPessoaIds;
    }

    public void setInquilinosPessoaIds(List<Long> inquilinosPessoaIds) {
        this.inquilinosPessoaIds = inquilinosPessoaIds;
    }

    public Boolean getAgendarCobrancaWhatsApp() {
        return agendarCobrancaWhatsApp;
    }

    public void setAgendarCobrancaWhatsApp(Boolean agendarCobrancaWhatsApp) {
        this.agendarCobrancaWhatsApp = agendarCobrancaWhatsApp;
    }
}
