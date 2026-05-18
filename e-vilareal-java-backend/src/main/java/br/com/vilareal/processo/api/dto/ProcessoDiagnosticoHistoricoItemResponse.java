package br.com.vilareal.processo.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Linha do relatório Diagnósticos «Consultas Realizadas» (andamento na data). */
public class ProcessoDiagnosticoHistoricoItemResponse {

    private String codigoCliente;
    private Integer numeroInterno;
    private String cliente;
    private String parteCliente;
    private String parteOposta;
    private String numeroProcessoNovo;
    private Long andamentoId;
    private String info;
    private String data;
    private String usuario;

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

    public String getCliente() {
        return cliente;
    }

    public void setCliente(String cliente) {
        this.cliente = cliente;
    }

    public String getParteCliente() {
        return parteCliente;
    }

    public void setParteCliente(String parteCliente) {
        this.parteCliente = parteCliente;
    }

    public String getParteOposta() {
        return parteOposta;
    }

    public void setParteOposta(String parteOposta) {
        this.parteOposta = parteOposta;
    }

    public String getNumeroProcessoNovo() {
        return numeroProcessoNovo;
    }

    public void setNumeroProcessoNovo(String numeroProcessoNovo) {
        this.numeroProcessoNovo = numeroProcessoNovo;
    }

    @Schema(description = "Id do andamento na API (processo_andamento)")
    public Long getAndamentoId() {
        return andamentoId;
    }

    public void setAndamentoId(Long andamentoId) {
        this.andamentoId = andamentoId;
    }

    public String getInfo() {
        return info;
    }

    public void setInfo(String info) {
        this.info = info;
    }

    @Schema(description = "Data do movimento em dd/mm/aaaa")
    public String getData() {
        return data;
    }

    public void setData(String data) {
        this.data = data;
    }

    public String getUsuario() {
        return usuario;
    }

    public void setUsuario(String usuario) {
        this.usuario = usuario;
    }
}
