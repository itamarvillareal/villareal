package br.com.vilareal.imovel.api.dto;

public class ImovelVinculoLocatarioResponse {

    private Integer numeroPlanilha;
    private String codigoCliente;
    private Integer numeroInterno;
    private Long processoId;
    private String camposExtrasJson;

    public Integer getNumeroPlanilha() {
        return numeroPlanilha;
    }

    public void setNumeroPlanilha(Integer numeroPlanilha) {
        this.numeroPlanilha = numeroPlanilha;
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

    public Long getProcessoId() {
        return processoId;
    }

    public void setProcessoId(Long processoId) {
        this.processoId = processoId;
    }

    public String getCamposExtrasJson() {
        return camposExtrasJson;
    }

    public void setCamposExtrasJson(String camposExtrasJson) {
        this.camposExtrasJson = camposExtrasJson;
    }
}
