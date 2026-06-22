package br.com.vilareal.imovel.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class ConciliarCondominioAutomaticoResponse {

    private String competencia;
    private int autoConciliados;
    private List<AutoConciliadoItem> autoConciliadosDetalhes = new ArrayList<>();
    private List<ParaRevisaoItem> paraRevisao = new ArrayList<>();
    private List<SemDebitoItem> semDebito = new ArrayList<>();

    public String getCompetencia() {
        return competencia;
    }

    public void setCompetencia(String competencia) {
        this.competencia = competencia;
    }

    public int getAutoConciliados() {
        return autoConciliados;
    }

    public void setAutoConciliados(int autoConciliados) {
        this.autoConciliados = autoConciliados;
    }

    public List<AutoConciliadoItem> getAutoConciliadosDetalhes() {
        return autoConciliadosDetalhes;
    }

    public void setAutoConciliadosDetalhes(List<AutoConciliadoItem> autoConciliadosDetalhes) {
        this.autoConciliadosDetalhes = autoConciliadosDetalhes;
    }

    public List<ParaRevisaoItem> getParaRevisao() {
        return paraRevisao;
    }

    public void setParaRevisao(List<ParaRevisaoItem> paraRevisao) {
        this.paraRevisao = paraRevisao;
    }

    public List<SemDebitoItem> getSemDebito() {
        return semDebito;
    }

    public void setSemDebito(List<SemDebitoItem> semDebito) {
        this.semDebito = semDebito;
    }

    public record AutoConciliadoItem(
            Long pagamentoId,
            Long lancamentoFinanceiroId,
            Long imovelId,
            Integer imovelNumeroPlanilha,
            BigDecimal valorPagamento,
            BigDecimal valorDebito,
            LocalDate dataDebito,
            String mesReferencia) {}

    public record ParaRevisaoItem(
            Long pagamentoId,
            Long imovelId,
            Integer imovelNumeroPlanilha,
            String mesReferencia,
            BigDecimal valorPagamento,
            String motivo,
            int quantidadeDebitosCandidatos) {}

    public record SemDebitoItem(
            Long pagamentoId, Long imovelId, Integer imovelNumeroPlanilha, String mesReferencia, BigDecimal valorPagamento) {}
}
