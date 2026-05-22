package br.com.vilareal.pagamento.api.dto;

import java.math.BigDecimal;

public class PagamentoAlertaValorResponse {

    private long count;
    private BigDecimal valorTotal;

    public PagamentoAlertaValorResponse() {}

    public PagamentoAlertaValorResponse(long count, BigDecimal valorTotal) {
        this.count = count;
        this.valorTotal = valorTotal;
    }

    public long getCount() {
        return count;
    }

    public void setCount(long count) {
        this.count = count;
    }

    public BigDecimal getValorTotal() {
        return valorTotal;
    }

    public void setValorTotal(BigDecimal valorTotal) {
        this.valorTotal = valorTotal;
    }
}
