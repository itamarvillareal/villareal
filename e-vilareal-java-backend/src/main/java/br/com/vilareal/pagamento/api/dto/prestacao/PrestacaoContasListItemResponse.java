package br.com.vilareal.pagamento.api.dto.prestacao;

import br.com.vilareal.pagamento.domain.PrestacaoContasStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public class PrestacaoContasListItemResponse {

    private Long id;
    private PrestacaoContasClienteDto cliente;
    private LocalDate periodoInicio;
    private LocalDate periodoFim;
    private BigDecimal valorTotalPagamentos;
    private BigDecimal taxaAdministracaoPercentual;
    private BigDecimal taxaAdministracaoValor;
    private BigDecimal valorLiquido;
    private PrestacaoContasStatus status;
    private int quantidadePagamentos;
    private Instant criadoEm;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public PrestacaoContasClienteDto getCliente() {
        return cliente;
    }

    public void setCliente(PrestacaoContasClienteDto cliente) {
        this.cliente = cliente;
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

    public BigDecimal getValorTotalPagamentos() {
        return valorTotalPagamentos;
    }

    public void setValorTotalPagamentos(BigDecimal valorTotalPagamentos) {
        this.valorTotalPagamentos = valorTotalPagamentos;
    }

    public BigDecimal getTaxaAdministracaoPercentual() {
        return taxaAdministracaoPercentual;
    }

    public void setTaxaAdministracaoPercentual(BigDecimal taxaAdministracaoPercentual) {
        this.taxaAdministracaoPercentual = taxaAdministracaoPercentual;
    }

    public BigDecimal getTaxaAdministracaoValor() {
        return taxaAdministracaoValor;
    }

    public void setTaxaAdministracaoValor(BigDecimal taxaAdministracaoValor) {
        this.taxaAdministracaoValor = taxaAdministracaoValor;
    }

    public BigDecimal getValorLiquido() {
        return valorLiquido;
    }

    public void setValorLiquido(BigDecimal valorLiquido) {
        this.valorLiquido = valorLiquido;
    }

    public PrestacaoContasStatus getStatus() {
        return status;
    }

    public void setStatus(PrestacaoContasStatus status) {
        this.status = status;
    }

    public int getQuantidadePagamentos() {
        return quantidadePagamentos;
    }

    public void setQuantidadePagamentos(int quantidadePagamentos) {
        this.quantidadePagamentos = quantidadePagamentos;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public void setCriadoEm(Instant criadoEm) {
        this.criadoEm = criadoEm;
    }
}
