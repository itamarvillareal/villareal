package br.com.vilareal.importacao.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Resultado do processamento de uma linha da planilha (número 1-based como no Excel)")
public class ImportacaoLinhaDetalhe {

    private int linhaExcel;
    private ImportacaoLinhaStatus status;
    private String mensagem;
    private Long clientePessoaId;
    private Integer numeroInterno;
    private Integer autoresVinculados;
    private Integer reusVinculados;

    public int getLinhaExcel() {
        return linhaExcel;
    }

    public void setLinhaExcel(int linhaExcel) {
        this.linhaExcel = linhaExcel;
    }

    public ImportacaoLinhaStatus getStatus() {
        return status;
    }

    public void setStatus(ImportacaoLinhaStatus status) {
        this.status = status;
    }

    public String getMensagem() {
        return mensagem;
    }

    public void setMensagem(String mensagem) {
        this.mensagem = mensagem;
    }

    public Long getClientePessoaId() {
        return clientePessoaId;
    }

    public void setClientePessoaId(Long clientePessoaId) {
        this.clientePessoaId = clientePessoaId;
    }

    public Integer getNumeroInterno() {
        return numeroInterno;
    }

    public void setNumeroInterno(Integer numeroInterno) {
        this.numeroInterno = numeroInterno;
    }

    public Integer getAutoresVinculados() {
        return autoresVinculados;
    }

    public void setAutoresVinculados(Integer autoresVinculados) {
        this.autoresVinculados = autoresVinculados;
    }

    public Integer getReusVinculados() {
        return reusVinculados;
    }

    public void setReusVinculados(Integer reusVinculados) {
        this.reusVinculados = reusVinculados;
    }
}
