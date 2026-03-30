package br.com.vilareal.importacao.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Resultado do processamento de uma linha (número 1-based como no Excel)")
public class ImportacaoInativarProcessosLinhaDetalhe {

    private int linhaExcel;
    private String codigoCliente;
    private Integer numeroInterno;
    private InativacaoProcessoLinhaStatus status;
    private String mensagem;
    private Long processoId;

    public int getLinhaExcel() {
        return linhaExcel;
    }

    public void setLinhaExcel(int linhaExcel) {
        this.linhaExcel = linhaExcel;
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

    public InativacaoProcessoLinhaStatus getStatus() {
        return status;
    }

    public void setStatus(InativacaoProcessoLinhaStatus status) {
        this.status = status;
    }

    public String getMensagem() {
        return mensagem;
    }

    public void setMensagem(String mensagem) {
        this.mensagem = mensagem;
    }

    public Long getProcessoId() {
        return processoId;
    }

    public void setProcessoId(Long processoId) {
        this.processoId = processoId;
    }
}
