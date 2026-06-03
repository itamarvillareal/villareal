package br.com.vilareal.pagamento.api.dto;

import java.math.BigDecimal;

/** Indicadores de cobranças / recebíveis (tipo RECEBER) no dashboard. */
public class PagamentoReceberResumoResponse {

    private long countEmitido;
    private BigDecimal totalEmitido = BigDecimal.ZERO;
    private long countRecebido;
    private BigDecimal totalRecebido = BigDecimal.ZERO;
    private long countAReceber;
    private BigDecimal totalAReceber = BigDecimal.ZERO;
    private long countVencido;
    private BigDecimal totalVencido = BigDecimal.ZERO;

    public long getCountEmitido() {
        return countEmitido;
    }

    public void setCountEmitido(long countEmitido) {
        this.countEmitido = countEmitido;
    }

    public BigDecimal getTotalEmitido() {
        return totalEmitido;
    }

    public void setTotalEmitido(BigDecimal totalEmitido) {
        this.totalEmitido = totalEmitido;
    }

    public long getCountRecebido() {
        return countRecebido;
    }

    public void setCountRecebido(long countRecebido) {
        this.countRecebido = countRecebido;
    }

    public BigDecimal getTotalRecebido() {
        return totalRecebido;
    }

    public void setTotalRecebido(BigDecimal totalRecebido) {
        this.totalRecebido = totalRecebido;
    }

    public long getCountAReceber() {
        return countAReceber;
    }

    public void setCountAReceber(long countAReceber) {
        this.countAReceber = countAReceber;
    }

    public BigDecimal getTotalAReceber() {
        return totalAReceber;
    }

    public void setTotalAReceber(BigDecimal totalAReceber) {
        this.totalAReceber = totalAReceber;
    }

    public long getCountVencido() {
        return countVencido;
    }

    public void setCountVencido(long countVencido) {
        this.countVencido = countVencido;
    }

    public BigDecimal getTotalVencido() {
        return totalVencido;
    }

    public void setTotalVencido(BigDecimal totalVencido) {
        this.totalVencido = totalVencido;
    }
}
