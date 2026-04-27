package br.com.vilareal.pagamento.api.dto;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

public class PagamentoDashboardResponse {

    private BigDecimal totalAPagarMes;
    private BigDecimal totalPagoMes;
    private BigDecimal totalPendente;
    private BigDecimal totalAgendado;
    private BigDecimal totalVencido;
    private BigDecimal totalConferenciaPendente;
    private BigDecimal totalPagoSemComprovante;
    private Map<String, BigDecimal> porCategoria = new LinkedHashMap<>();
    private Map<String, BigDecimal> porResponsavel = new LinkedHashMap<>();

    public BigDecimal getTotalAPagarMes() {
        return totalAPagarMes;
    }

    public void setTotalAPagarMes(BigDecimal totalAPagarMes) {
        this.totalAPagarMes = totalAPagarMes;
    }

    public BigDecimal getTotalPagoMes() {
        return totalPagoMes;
    }

    public void setTotalPagoMes(BigDecimal totalPagoMes) {
        this.totalPagoMes = totalPagoMes;
    }

    public BigDecimal getTotalPendente() {
        return totalPendente;
    }

    public void setTotalPendente(BigDecimal totalPendente) {
        this.totalPendente = totalPendente;
    }

    public BigDecimal getTotalAgendado() {
        return totalAgendado;
    }

    public void setTotalAgendado(BigDecimal totalAgendado) {
        this.totalAgendado = totalAgendado;
    }

    public BigDecimal getTotalVencido() {
        return totalVencido;
    }

    public void setTotalVencido(BigDecimal totalVencido) {
        this.totalVencido = totalVencido;
    }

    public BigDecimal getTotalConferenciaPendente() {
        return totalConferenciaPendente;
    }

    public void setTotalConferenciaPendente(BigDecimal totalConferenciaPendente) {
        this.totalConferenciaPendente = totalConferenciaPendente;
    }

    public BigDecimal getTotalPagoSemComprovante() {
        return totalPagoSemComprovante;
    }

    public void setTotalPagoSemComprovante(BigDecimal totalPagoSemComprovante) {
        this.totalPagoSemComprovante = totalPagoSemComprovante;
    }

    public Map<String, BigDecimal> getPorCategoria() {
        return porCategoria;
    }

    public void setPorCategoria(Map<String, BigDecimal> porCategoria) {
        this.porCategoria = porCategoria;
    }

    public Map<String, BigDecimal> getPorResponsavel() {
        return porResponsavel;
    }

    public void setPorResponsavel(Map<String, BigDecimal> porResponsavel) {
        this.porResponsavel = porResponsavel;
    }
}
