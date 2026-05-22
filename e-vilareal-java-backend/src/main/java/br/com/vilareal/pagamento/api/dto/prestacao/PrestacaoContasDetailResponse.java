package br.com.vilareal.pagamento.api.dto.prestacao;

import br.com.vilareal.pagamento.domain.PrestacaoContasStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class PrestacaoContasDetailResponse {

    private Long id;
    private PrestacaoContasClienteDto cliente;
    private LocalDate periodoInicio;
    private LocalDate periodoFim;
    private BigDecimal valorTotalPagamentos;
    private BigDecimal taxaAdministracaoPercentual;
    private BigDecimal taxaAdministracaoValor;
    private BigDecimal valorLiquido;
    private PrestacaoContasStatus status;
    private String observacoes;
    private String arquivoPdfPath;
    private Instant criadoEm;
    private List<PrestacaoContasPagamentoItemDto> pagamentos = new ArrayList<>();
    private List<PrestacaoContasGrupoImovelDetailDto> gruposPorImovel = new ArrayList<>();

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

    public String getObservacoes() {
        return observacoes;
    }

    public void setObservacoes(String observacoes) {
        this.observacoes = observacoes;
    }

    public String getArquivoPdfPath() {
        return arquivoPdfPath;
    }

    public void setArquivoPdfPath(String arquivoPdfPath) {
        this.arquivoPdfPath = arquivoPdfPath;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public void setCriadoEm(Instant criadoEm) {
        this.criadoEm = criadoEm;
    }

    public List<PrestacaoContasPagamentoItemDto> getPagamentos() {
        return pagamentos;
    }

    public void setPagamentos(List<PrestacaoContasPagamentoItemDto> pagamentos) {
        this.pagamentos = pagamentos;
    }

    public List<PrestacaoContasGrupoImovelDetailDto> getGruposPorImovel() {
        return gruposPorImovel;
    }

    public void setGruposPorImovel(List<PrestacaoContasGrupoImovelDetailDto> gruposPorImovel) {
        this.gruposPorImovel = gruposPorImovel;
    }
}
