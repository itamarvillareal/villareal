package br.com.vilareal.pagamento.api.dto.prestacao;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public class PrestacaoContasCreateRequest {

    @NotNull
    private Long clienteId;

    @NotNull
    private LocalDate periodoInicio;

    @NotNull
    private LocalDate periodoFim;

    @NotEmpty
    private List<Long> pagamentoIds;

    @DecimalMin("0")
    @DecimalMax("100")
    private BigDecimal taxaAdministracaoPercentual;

    private String observacoes;

    public Long getClienteId() {
        return clienteId;
    }

    public void setClienteId(Long clienteId) {
        this.clienteId = clienteId;
    }

    public LocalDate getPeriodoInicio() {
        return periodoInicio;
    }

    public void setPeriodoInicio(LocalDate periodoInicio) {
        this.periodoInicio = periodoInicio;
    }

    public LocalDate getPeriodoFim() {
        return periodoFim;
    }

    public void setPeriodoFim(LocalDate periodoFim) {
        this.periodoFim = periodoFim;
    }

    public List<Long> getPagamentoIds() {
        return pagamentoIds;
    }

    public void setPagamentoIds(List<Long> pagamentoIds) {
        this.pagamentoIds = pagamentoIds;
    }

    public BigDecimal getTaxaAdministracaoPercentual() {
        return taxaAdministracaoPercentual;
    }

    public void setTaxaAdministracaoPercentual(BigDecimal taxaAdministracaoPercentual) {
        this.taxaAdministracaoPercentual = taxaAdministracaoPercentual;
    }

    public String getObservacoes() {
        return observacoes;
    }

    public void setObservacoes(String observacoes) {
        this.observacoes = observacoes;
    }
}
