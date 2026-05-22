package br.com.vilareal.imovel.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Par código de cliente + proc. vinculado ao mesmo nº de imóvel (planilha)")
public class ImovelVinculoProcessoItemResponse {

    private String codigoCliente;
    private Integer numeroInterno;
    private Long processoId;
    private Long imovelId;
    private Integer numeroPlanilhaImovel;
    private boolean cadastroAtual;
    private boolean principal;

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

    public Long getProcessoId() {
        return processoId;
    }

    public void setProcessoId(Long processoId) {
        this.processoId = processoId;
    }

    public Long getImovelId() {
        return imovelId;
    }

    public void setImovelId(Long imovelId) {
        this.imovelId = imovelId;
    }

    public Integer getNumeroPlanilhaImovel() {
        return numeroPlanilhaImovel;
    }

    public void setNumeroPlanilhaImovel(Integer numeroPlanilhaImovel) {
        this.numeroPlanilhaImovel = numeroPlanilhaImovel;
    }

    public boolean isCadastroAtual() {
        return cadastroAtual;
    }

    public void setCadastroAtual(boolean cadastroAtual) {
        this.cadastroAtual = cadastroAtual;
    }

    public boolean isPrincipal() {
        return principal;
    }

    public void setPrincipal(boolean principal) {
        this.principal = principal;
    }
}
