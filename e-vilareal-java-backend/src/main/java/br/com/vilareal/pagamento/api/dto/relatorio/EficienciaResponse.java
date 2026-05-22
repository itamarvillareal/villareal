package br.com.vilareal.pagamento.api.dto.relatorio;

import java.util.ArrayList;
import java.util.List;

public class EficienciaResponse {

    private RelatorioPeriodoDto periodo;
    private EficienciaMetricas metricas;
    private List<EficienciaSerieMensal> serieMensal = new ArrayList<>();

    public RelatorioPeriodoDto getPeriodo() {
        return periodo;
    }

    public void setPeriodo(RelatorioPeriodoDto periodo) {
        this.periodo = periodo;
    }

    public EficienciaMetricas getMetricas() {
        return metricas;
    }

    public void setMetricas(EficienciaMetricas metricas) {
        this.metricas = metricas;
    }

    public List<EficienciaSerieMensal> getSerieMensal() {
        return serieMensal;
    }

    public void setSerieMensal(List<EficienciaSerieMensal> serieMensal) {
        this.serieMensal = serieMensal;
    }

    public static class EficienciaMetricas {
        private Double tempoMedioIdentificacaoAgendamento;
        private Double tempoMedioAgendamentoPagamento;
        private Double taxaFalhaBancaria;
        private Double taxaDivergenciaValor;
        private Double taxaVencidos;

        public Double getTempoMedioIdentificacaoAgendamento() {
            return tempoMedioIdentificacaoAgendamento;
        }

        public void setTempoMedioIdentificacaoAgendamento(Double tempoMedioIdentificacaoAgendamento) {
            this.tempoMedioIdentificacaoAgendamento = tempoMedioIdentificacaoAgendamento;
        }

        public Double getTempoMedioAgendamentoPagamento() {
            return tempoMedioAgendamentoPagamento;
        }

        public void setTempoMedioAgendamentoPagamento(Double tempoMedioAgendamentoPagamento) {
            this.tempoMedioAgendamentoPagamento = tempoMedioAgendamentoPagamento;
        }

        public Double getTaxaFalhaBancaria() {
            return taxaFalhaBancaria;
        }

        public void setTaxaFalhaBancaria(Double taxaFalhaBancaria) {
            this.taxaFalhaBancaria = taxaFalhaBancaria;
        }

        public Double getTaxaDivergenciaValor() {
            return taxaDivergenciaValor;
        }

        public void setTaxaDivergenciaValor(Double taxaDivergenciaValor) {
            this.taxaDivergenciaValor = taxaDivergenciaValor;
        }

        public Double getTaxaVencidos() {
            return taxaVencidos;
        }

        public void setTaxaVencidos(Double taxaVencidos) {
            this.taxaVencidos = taxaVencidos;
        }
    }

    public static class EficienciaSerieMensal {
        private int mes;
        private String nomeMes;
        private Double tempoMedioIdentificacaoAgendamento;
        private Double tempoMedioAgendamentoPagamento;
        private Double taxaFalhaBancaria;
        private Double taxaDivergenciaValor;
        private Double taxaVencidos;

        public int getMes() {
            return mes;
        }

        public void setMes(int mes) {
            this.mes = mes;
        }

        public String getNomeMes() {
            return nomeMes;
        }

        public void setNomeMes(String nomeMes) {
            this.nomeMes = nomeMes;
        }

        public Double getTempoMedioIdentificacaoAgendamento() {
            return tempoMedioIdentificacaoAgendamento;
        }

        public void setTempoMedioIdentificacaoAgendamento(Double v) {
            this.tempoMedioIdentificacaoAgendamento = v;
        }

        public Double getTempoMedioAgendamentoPagamento() {
            return tempoMedioAgendamentoPagamento;
        }

        public void setTempoMedioAgendamentoPagamento(Double v) {
            this.tempoMedioAgendamentoPagamento = v;
        }

        public Double getTaxaFalhaBancaria() {
            return taxaFalhaBancaria;
        }

        public void setTaxaFalhaBancaria(Double v) {
            this.taxaFalhaBancaria = v;
        }

        public Double getTaxaDivergenciaValor() {
            return taxaDivergenciaValor;
        }

        public void setTaxaDivergenciaValor(Double v) {
            this.taxaDivergenciaValor = v;
        }

        public Double getTaxaVencidos() {
            return taxaVencidos;
        }

        public void setTaxaVencidos(Double v) {
            this.taxaVencidos = v;
        }
    }
}
