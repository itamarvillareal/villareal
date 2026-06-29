package br.com.vilareal.processo.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Listagem enxuta para a grade de processos na tela Clientes ({@code GET /api/processos?resumo=true}).
 */
@Schema(description = "Processo resumido para grade Clientes")
public class ProcessoGradeResponse {

    private Long id;
    private Long clienteId;
    private String codigoCliente;
    private Integer numeroInterno;
    private String numeroCnj;
    private String numeroProcessoAntigo;
    private String naturezaAcao;
    private String descricaoAcao;
    private String parteCliente;
    private String parteOposta;
    private String titularNome;
    private String unidade;
    private Boolean ativo;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getClienteId() {
        return clienteId;
    }

    public void setClienteId(Long clienteId) {
        this.clienteId = clienteId;
    }

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

    public String getNumeroCnj() {
        return numeroCnj;
    }

    public void setNumeroCnj(String numeroCnj) {
        this.numeroCnj = numeroCnj;
    }

    public String getNumeroProcessoAntigo() {
        return numeroProcessoAntigo;
    }

    public void setNumeroProcessoAntigo(String numeroProcessoAntigo) {
        this.numeroProcessoAntigo = numeroProcessoAntigo;
    }

    public String getNaturezaAcao() {
        return naturezaAcao;
    }

    public void setNaturezaAcao(String naturezaAcao) {
        this.naturezaAcao = naturezaAcao;
    }

    public String getDescricaoAcao() {
        return descricaoAcao;
    }

    public void setDescricaoAcao(String descricaoAcao) {
        this.descricaoAcao = descricaoAcao;
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

    public String getTitularNome() {
        return titularNome;
    }

    public void setTitularNome(String titularNome) {
        this.titularNome = titularNome;
    }

    public String getUnidade() {
        return unidade;
    }

    public void setUnidade(String unidade) {
        this.unidade = unidade;
    }

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }
}
