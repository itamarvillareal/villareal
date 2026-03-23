package br.com.vilareal.api.dto;

import java.math.BigDecimal;

public class ResumoContaCorrenteProcessoResponse {
    private Long processoId;
    private BigDecimal saldo;
    private Long totalLancamentos;

    public Long getProcessoId() { return processoId; }
    public void setProcessoId(Long processoId) { this.processoId = processoId; }
    public BigDecimal getSaldo() { return saldo; }
    public void setSaldo(BigDecimal saldo) { this.saldo = saldo; }
    public Long getTotalLancamentos() { return totalLancamentos; }
    public void setTotalLancamentos(Long totalLancamentos) { this.totalLancamentos = totalLancamentos; }
}
