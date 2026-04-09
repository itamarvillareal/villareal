package br.com.vilareal.imovel.api.dto;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public class LocacaoRepasseWriteRequest {

    @NotNull
    private Long contratoId;

    private String competenciaMes;
    private BigDecimal valorRecebidoInquilino;
    private BigDecimal valorRepassadoLocador;
    private BigDecimal valorDespesasRepassar;
    private BigDecimal remuneracaoEscritorio;
    private String status;
    private LocalDate dataRepasseEfetiva;
    private String observacao;
    private Long lancamentoFinanceiroVinculoId;

    public Long getContratoId() {
        return contratoId;
    }

    public void setContratoId(Long contratoId) {
        this.contratoId = contratoId;
    }

    public String getCompetenciaMes() {
        return competenciaMes;
    }

    public void setCompetenciaMes(String competenciaMes) {
        this.competenciaMes = competenciaMes;
    }

    public BigDecimal getValorRecebidoInquilino() {
        return valorRecebidoInquilino;
    }

    public void setValorRecebidoInquilino(BigDecimal valorRecebidoInquilino) {
        this.valorRecebidoInquilino = valorRecebidoInquilino;
    }

    public BigDecimal getValorRepassadoLocador() {
        return valorRepassadoLocador;
    }

    public void setValorRepassadoLocador(BigDecimal valorRepassadoLocador) {
        this.valorRepassadoLocador = valorRepassadoLocador;
    }

    public BigDecimal getValorDespesasRepassar() {
        return valorDespesasRepassar;
    }

    public void setValorDespesasRepassar(BigDecimal valorDespesasRepassar) {
        this.valorDespesasRepassar = valorDespesasRepassar;
    }

    public BigDecimal getRemuneracaoEscritorio() {
        return remuneracaoEscritorio;
    }

    public void setRemuneracaoEscritorio(BigDecimal remuneracaoEscritorio) {
        this.remuneracaoEscritorio = remuneracaoEscritorio;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDate getDataRepasseEfetiva() {
        return dataRepasseEfetiva;
    }

    public void setDataRepasseEfetiva(LocalDate dataRepasseEfetiva) {
        this.dataRepasseEfetiva = dataRepasseEfetiva;
    }

    public String getObservacao() {
        return observacao;
    }

    public void setObservacao(String observacao) {
        this.observacao = observacao;
    }

    public Long getLancamentoFinanceiroVinculoId() {
        return lancamentoFinanceiroVinculoId;
    }

    public void setLancamentoFinanceiroVinculoId(Long lancamentoFinanceiroVinculoId) {
        this.lancamentoFinanceiroVinculoId = lancamentoFinanceiroVinculoId;
    }
}
