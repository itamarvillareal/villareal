package br.com.vilareal.api.dto;

import br.com.vilareal.api.entity.enums.RepasseLocadorStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class RepasseLocadorResponse {
    private Long id;
    private Long contratoId;
    private String competenciaMes;
    private BigDecimal valorRecebidoInquilino;
    private BigDecimal valorRepassadoLocador;
    private BigDecimal valorDespesasRepassar;
    private BigDecimal remuneracaoEscritorio;
    private RepasseLocadorStatus status;
    private LocalDate dataRepasseEfetiva;
    private String observacao;
    private Long lancamentoFinanceiroVinculoId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getContratoId() { return contratoId; }
    public void setContratoId(Long contratoId) { this.contratoId = contratoId; }
    public String getCompetenciaMes() { return competenciaMes; }
    public void setCompetenciaMes(String competenciaMes) { this.competenciaMes = competenciaMes; }
    public BigDecimal getValorRecebidoInquilino() { return valorRecebidoInquilino; }
    public void setValorRecebidoInquilino(BigDecimal valorRecebidoInquilino) { this.valorRecebidoInquilino = valorRecebidoInquilino; }
    public BigDecimal getValorRepassadoLocador() { return valorRepassadoLocador; }
    public void setValorRepassadoLocador(BigDecimal valorRepassadoLocador) { this.valorRepassadoLocador = valorRepassadoLocador; }
    public BigDecimal getValorDespesasRepassar() { return valorDespesasRepassar; }
    public void setValorDespesasRepassar(BigDecimal valorDespesasRepassar) { this.valorDespesasRepassar = valorDespesasRepassar; }
    public BigDecimal getRemuneracaoEscritorio() { return remuneracaoEscritorio; }
    public void setRemuneracaoEscritorio(BigDecimal remuneracaoEscritorio) { this.remuneracaoEscritorio = remuneracaoEscritorio; }
    public RepasseLocadorStatus getStatus() { return status; }
    public void setStatus(RepasseLocadorStatus status) { this.status = status; }
    public LocalDate getDataRepasseEfetiva() { return dataRepasseEfetiva; }
    public void setDataRepasseEfetiva(LocalDate dataRepasseEfetiva) { this.dataRepasseEfetiva = dataRepasseEfetiva; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String observacao) { this.observacao = observacao; }
    public Long getLancamentoFinanceiroVinculoId() { return lancamentoFinanceiroVinculoId; }
    public void setLancamentoFinanceiroVinculoId(Long lancamentoFinanceiroVinculoId) { this.lancamentoFinanceiroVinculoId = lancamentoFinanceiroVinculoId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
