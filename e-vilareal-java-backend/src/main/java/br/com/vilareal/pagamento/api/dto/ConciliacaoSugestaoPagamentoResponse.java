package br.com.vilareal.pagamento.api.dto;

import java.util.ArrayList;
import java.util.List;

public class ConciliacaoSugestaoPagamentoResponse {

    private PagamentoResponse pagamento;
    private List<ConciliacaoSugestaoItem> sugestoes = new ArrayList<>();

    public PagamentoResponse getPagamento() {
        return pagamento;
    }

    public void setPagamento(PagamentoResponse pagamento) {
        this.pagamento = pagamento;
    }

    public List<ConciliacaoSugestaoItem> getSugestoes() {
        return sugestoes;
    }

    public void setSugestoes(List<ConciliacaoSugestaoItem> sugestoes) {
        this.sugestoes = sugestoes;
    }
}
