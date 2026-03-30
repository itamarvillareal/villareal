package br.com.vilareal.importacao.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Resultado da persistência de uma linha Pasta1")
public class Pasta1ClientePessoaPersistLinhaDetalhe {

    private int linhaExcel;
    private String chaveCliente;
    private Long pessoaId;
    private Pasta1ClientePessoaPersistStatus status;
    private String mensagem;

    public int getLinhaExcel() {
        return linhaExcel;
    }

    public void setLinhaExcel(int linhaExcel) {
        this.linhaExcel = linhaExcel;
    }

    public String getChaveCliente() {
        return chaveCliente;
    }

    public void setChaveCliente(String chaveCliente) {
        this.chaveCliente = chaveCliente;
    }

    public Long getPessoaId() {
        return pessoaId;
    }

    public void setPessoaId(Long pessoaId) {
        this.pessoaId = pessoaId;
    }

    public Pasta1ClientePessoaPersistStatus getStatus() {
        return status;
    }

    public void setStatus(Pasta1ClientePessoaPersistStatus status) {
        this.status = status;
    }

    public String getMensagem() {
        return mensagem;
    }

    public void setMensagem(String mensagem) {
        this.mensagem = mensagem;
    }
}
