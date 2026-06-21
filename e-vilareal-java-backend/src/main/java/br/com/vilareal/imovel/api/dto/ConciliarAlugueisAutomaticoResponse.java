package br.com.vilareal.imovel.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class ConciliarAlugueisAutomaticoResponse {

    private String competencia;
    private int autoVinculados;
    private List<AutoVinculadoItem> autoVinculadosDetalhes = new ArrayList<>();
    private List<ParaRevisaoItem> paraRevisao = new ArrayList<>();
    private List<SemCreditoItem> semCredito = new ArrayList<>();

    public String getCompetencia() {
        return competencia;
    }

    public void setCompetencia(String competencia) {
        this.competencia = competencia;
    }

    public int getAutoVinculados() {
        return autoVinculados;
    }

    public void setAutoVinculados(int autoVinculados) {
        this.autoVinculados = autoVinculados;
    }

    public List<AutoVinculadoItem> getAutoVinculadosDetalhes() {
        return autoVinculadosDetalhes;
    }

    public void setAutoVinculadosDetalhes(List<AutoVinculadoItem> autoVinculadosDetalhes) {
        this.autoVinculadosDetalhes = autoVinculadosDetalhes;
    }

    public List<ParaRevisaoItem> getParaRevisao() {
        return paraRevisao;
    }

    public void setParaRevisao(List<ParaRevisaoItem> paraRevisao) {
        this.paraRevisao = paraRevisao;
    }

    public List<SemCreditoItem> getSemCredito() {
        return semCredito;
    }

    public void setSemCredito(List<SemCreditoItem> semCredito) {
        this.semCredito = semCredito;
    }

    public record AutoVinculadoItem(
            Long contratoId,
            Long vinculoId,
            Long lancamentoFinanceiroId,
            Integer imovelNumeroPlanilha,
            BigDecimal valorAluguel,
            LocalDate dataCredito,
            BigDecimal valorCredito) {}

    public record ParaRevisaoItem(
            Long contratoId,
            Integer imovelNumeroPlanilha,
            BigDecimal valorAluguel,
            String motivo,
            int quantidadeCreditosCandidatos) {}

    public record SemCreditoItem(Long contratoId, Integer imovelNumeroPlanilha, BigDecimal valorAluguel) {}
}
