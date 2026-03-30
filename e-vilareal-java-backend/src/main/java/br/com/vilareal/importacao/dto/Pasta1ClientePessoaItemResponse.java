package br.com.vilareal.importacao.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Uma linha da planilha: coluna A (cliente) + coluna B (número de pessoa). */
public class Pasta1ClientePessoaItemResponse {

    @Schema(description = "Número da linha no Excel (1-based)")
    private int linhaExcel;

    @Schema(description = "Valor lido na coluna A (primeira coluna)")
    private String clienteColunaA;

    @Schema(description = "Número de pessoa (coluna B), se válido")
    private Long pessoaId;

    @Schema(description = "Mensagem se coluna B não for um id numérico válido")
    private String aviso;

    public int getLinhaExcel() {
        return linhaExcel;
    }

    public void setLinhaExcel(int linhaExcel) {
        this.linhaExcel = linhaExcel;
    }

    public String getClienteColunaA() {
        return clienteColunaA;
    }

    public void setClienteColunaA(String clienteColunaA) {
        this.clienteColunaA = clienteColunaA;
    }

    public Long getPessoaId() {
        return pessoaId;
    }

    public void setPessoaId(Long pessoaId) {
        this.pessoaId = pessoaId;
    }

    public String getAviso() {
        return aviso;
    }

    public void setAviso(String aviso) {
        this.aviso = aviso;
    }
}
