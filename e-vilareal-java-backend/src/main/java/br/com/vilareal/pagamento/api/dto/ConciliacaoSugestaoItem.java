package br.com.vilareal.pagamento.api.dto;

import java.util.ArrayList;
import java.util.List;

public class ConciliacaoSugestaoItem {

    private ConciliacaoLancamentoResumo lancamento;
    private int score;
    private List<String> motivos = new ArrayList<>();

    public ConciliacaoLancamentoResumo getLancamento() {
        return lancamento;
    }

    public void setLancamento(ConciliacaoLancamentoResumo lancamento) {
        this.lancamento = lancamento;
    }

    public int getScore() {
        return score;
    }

    public void setScore(int score) {
        this.score = score;
    }

    public List<String> getMotivos() {
        return motivos;
    }

    public void setMotivos(List<String> motivos) {
        this.motivos = motivos;
    }
}
