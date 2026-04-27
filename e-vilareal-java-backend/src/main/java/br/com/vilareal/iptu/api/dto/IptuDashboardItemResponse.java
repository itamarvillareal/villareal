package br.com.vilareal.iptu.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public class IptuDashboardItemResponse {

    private Long imovelId;
    private Integer numeroPlanilha;
    private String titulo;
    private String condominio;
    private String unidade;
    private String inquilinoNome;
    private LocalDate contratoDataInicio;
    private LocalDate contratoDataFim;
    private Long iptuAnualId;
    private Integer anoReferencia;
    private BigDecimal valorAnual;
    private BigDecimal totalPago;
    private BigDecimal totalPendente;
    private BigDecimal totalAtrasado;
    private String proximaCompetencia;
    private BigDecimal proximaValor;
    private LocalDate proximaVencimento;
    private LocalDate ultimaConsultaData;
    private Boolean ultimaConsultaExisteDebito;

    public Long getImovelId() {
        return imovelId;
    }

    public void setImovelId(Long imovelId) {
        this.imovelId = imovelId;
    }

    public Integer getNumeroPlanilha() {
        return numeroPlanilha;
    }

    public void setNumeroPlanilha(Integer numeroPlanilha) {
        this.numeroPlanilha = numeroPlanilha;
    }

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
    }

    public String getCondominio() {
        return condominio;
    }

    public void setCondominio(String condominio) {
        this.condominio = condominio;
    }

    public String getUnidade() {
        return unidade;
    }

    public void setUnidade(String unidade) {
        this.unidade = unidade;
    }

    public String getInquilinoNome() {
        return inquilinoNome;
    }

    public void setInquilinoNome(String inquilinoNome) {
        this.inquilinoNome = inquilinoNome;
    }

    public LocalDate getContratoDataInicio() {
        return contratoDataInicio;
    }

    public void setContratoDataInicio(LocalDate contratoDataInicio) {
        this.contratoDataInicio = contratoDataInicio;
    }

    public LocalDate getContratoDataFim() {
        return contratoDataFim;
    }

    public void setContratoDataFim(LocalDate contratoDataFim) {
        this.contratoDataFim = contratoDataFim;
    }

    public Long getIptuAnualId() {
        return iptuAnualId;
    }

    public void setIptuAnualId(Long iptuAnualId) {
        this.iptuAnualId = iptuAnualId;
    }

    public Integer getAnoReferencia() {
        return anoReferencia;
    }

    public void setAnoReferencia(Integer anoReferencia) {
        this.anoReferencia = anoReferencia;
    }

    public BigDecimal getValorAnual() {
        return valorAnual;
    }

    public void setValorAnual(BigDecimal valorAnual) {
        this.valorAnual = valorAnual;
    }

    public BigDecimal getTotalPago() {
        return totalPago;
    }

    public void setTotalPago(BigDecimal totalPago) {
        this.totalPago = totalPago;
    }

    public BigDecimal getTotalPendente() {
        return totalPendente;
    }

    public void setTotalPendente(BigDecimal totalPendente) {
        this.totalPendente = totalPendente;
    }

    public BigDecimal getTotalAtrasado() {
        return totalAtrasado;
    }

    public void setTotalAtrasado(BigDecimal totalAtrasado) {
        this.totalAtrasado = totalAtrasado;
    }

    public String getProximaCompetencia() {
        return proximaCompetencia;
    }

    public void setProximaCompetencia(String proximaCompetencia) {
        this.proximaCompetencia = proximaCompetencia;
    }

    public BigDecimal getProximaValor() {
        return proximaValor;
    }

    public void setProximaValor(BigDecimal proximaValor) {
        this.proximaValor = proximaValor;
    }

    public LocalDate getProximaVencimento() {
        return proximaVencimento;
    }

    public void setProximaVencimento(LocalDate proximaVencimento) {
        this.proximaVencimento = proximaVencimento;
    }

    public LocalDate getUltimaConsultaData() {
        return ultimaConsultaData;
    }

    public void setUltimaConsultaData(LocalDate ultimaConsultaData) {
        this.ultimaConsultaData = ultimaConsultaData;
    }

    public Boolean getUltimaConsultaExisteDebito() {
        return ultimaConsultaExisteDebito;
    }

    public void setUltimaConsultaExisteDebito(Boolean ultimaConsultaExisteDebito) {
        this.ultimaConsultaExisteDebito = ultimaConsultaExisteDebito;
    }
}
