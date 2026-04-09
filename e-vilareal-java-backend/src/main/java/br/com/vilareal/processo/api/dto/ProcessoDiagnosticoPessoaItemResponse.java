package br.com.vilareal.processo.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Item para o modal «Busca pessoa» em Diagnósticos — alinhado ao shape de {@code listarProcessosPorIdPessoa} no front.
 */
public class ProcessoDiagnosticoPessoaItemResponse {

    private String codigoCliente;
    private Integer numeroInterno;
    private String cliente;
    private String parteCliente;
    private String parteOposta;
    private String numeroProcessoNovo;
    private String papeis;

    @Schema(description = "Código do cliente dono do processo (8 dígitos)")
    public String getCodigoCliente() {
        return codigoCliente;
    }

    public void setCodigoCliente(String codigoCliente) {
        this.codigoCliente = codigoCliente;
    }

    @Schema(description = "Número interno do processo na pasta do cliente")
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

    @Schema(description = "Nº CNJ / processo novo")
    public String getNumeroProcessoNovo() {
        return numeroProcessoNovo;
    }

    public void setNumeroProcessoNovo(String numeroProcessoNovo) {
        this.numeroProcessoNovo = numeroProcessoNovo;
    }

    @Schema(description = "Papéis da pessoa consultada neste processo")
    public String getPapeis() {
        return papeis;
    }

    public void setPapeis(String papeis) {
        this.papeis = papeis;
    }
}
