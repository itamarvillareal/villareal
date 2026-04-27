package br.com.vilareal.pagamento.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

@Schema(description = "Criar ou atualizar pagamento")
public class PagamentoWriteRequest {

    private LocalDate dataCadastro;

    private LocalDate dataAgendamento;

    @NotNull
    private LocalDate dataVencimento;

    @Size(max = 180)
    private String codigoBarras;

    @NotNull
    @DecimalMin(value = "0.01", inclusive = true)
    private BigDecimal valor;

    @NotBlank
    @Size(max = 500)
    private String descricao;

    @NotBlank
    @Size(max = 40)
    private String categoria;

    @NotBlank
    @Size(max = 40)
    private String formaPagamento;

    private Long responsavelUsuarioId;

    @NotBlank
    @Size(max = 40)
    private String status;

    @Size(max = 24)
    private String prioridade;

    @Size(max = 120)
    private String origem;

    private LocalDate dataPagamentoEfetivo;

    private String observacoes;

    private Long clienteId;
    private Long processoId;
    private Long imovelId;

    @Size(max = 255)
    private String condominioTexto;

    private Long contratoLocacaoId;

    @Size(max = 255)
    private String fornecedorTexto;

    private Boolean recorrente;

    private String recorrenciaTipo;

    private Integer recorrenciaQuantidadeParcelas;

    private Integer recorrenciaParcelaAtual;

    private Boolean recorrenciaValorFixo;

    private String recorrenciaDescricaoPadrao;

    private Long recorrenciaPagamentoOrigemId;

    public LocalDate getDataCadastro() {
        return dataCadastro;
    }

    public void setDataCadastro(LocalDate dataCadastro) {
        this.dataCadastro = dataCadastro;
    }

    public LocalDate getDataAgendamento() {
        return dataAgendamento;
    }

    public void setDataAgendamento(LocalDate dataAgendamento) {
        this.dataAgendamento = dataAgendamento;
    }

    public LocalDate getDataVencimento() {
        return dataVencimento;
    }

    public void setDataVencimento(LocalDate dataVencimento) {
        this.dataVencimento = dataVencimento;
    }

    public String getCodigoBarras() {
        return codigoBarras;
    }

    public void setCodigoBarras(String codigoBarras) {
        this.codigoBarras = codigoBarras;
    }

    public BigDecimal getValor() {
        return valor;
    }

    public void setValor(BigDecimal valor) {
        this.valor = valor;
    }

    public String getDescricao() {
        return descricao;
    }

    public void setDescricao(String descricao) {
        this.descricao = descricao;
    }

    public String getCategoria() {
        return categoria;
    }

    public void setCategoria(String categoria) {
        this.categoria = categoria;
    }

    public String getFormaPagamento() {
        return formaPagamento;
    }

    public void setFormaPagamento(String formaPagamento) {
        this.formaPagamento = formaPagamento;
    }

    public Long getResponsavelUsuarioId() {
        return responsavelUsuarioId;
    }

    public void setResponsavelUsuarioId(Long responsavelUsuarioId) {
        this.responsavelUsuarioId = responsavelUsuarioId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getPrioridade() {
        return prioridade;
    }

    public void setPrioridade(String prioridade) {
        this.prioridade = prioridade;
    }

    public String getOrigem() {
        return origem;
    }

    public void setOrigem(String origem) {
        this.origem = origem;
    }

    public LocalDate getDataPagamentoEfetivo() {
        return dataPagamentoEfetivo;
    }

    public void setDataPagamentoEfetivo(LocalDate dataPagamentoEfetivo) {
        this.dataPagamentoEfetivo = dataPagamentoEfetivo;
    }

    public String getObservacoes() {
        return observacoes;
    }

    public void setObservacoes(String observacoes) {
        this.observacoes = observacoes;
    }

    public Long getClienteId() {
        return clienteId;
    }

    public void setClienteId(Long clienteId) {
        this.clienteId = clienteId;
    }

    public Long getProcessoId() {
        return processoId;
    }

    public void setProcessoId(Long processoId) {
        this.processoId = processoId;
    }

    public Long getImovelId() {
        return imovelId;
    }

    public void setImovelId(Long imovelId) {
        this.imovelId = imovelId;
    }

    public String getCondominioTexto() {
        return condominioTexto;
    }

    public void setCondominioTexto(String condominioTexto) {
        this.condominioTexto = condominioTexto;
    }

    public Long getContratoLocacaoId() {
        return contratoLocacaoId;
    }

    public void setContratoLocacaoId(Long contratoLocacaoId) {
        this.contratoLocacaoId = contratoLocacaoId;
    }

    public String getFornecedorTexto() {
        return fornecedorTexto;
    }

    public void setFornecedorTexto(String fornecedorTexto) {
        this.fornecedorTexto = fornecedorTexto;
    }

    public Boolean getRecorrente() {
        return recorrente;
    }

    public void setRecorrente(Boolean recorrente) {
        this.recorrente = recorrente;
    }

    public String getRecorrenciaTipo() {
        return recorrenciaTipo;
    }

    public void setRecorrenciaTipo(String recorrenciaTipo) {
        this.recorrenciaTipo = recorrenciaTipo;
    }

    public Integer getRecorrenciaQuantidadeParcelas() {
        return recorrenciaQuantidadeParcelas;
    }

    public void setRecorrenciaQuantidadeParcelas(Integer recorrenciaQuantidadeParcelas) {
        this.recorrenciaQuantidadeParcelas = recorrenciaQuantidadeParcelas;
    }

    public Integer getRecorrenciaParcelaAtual() {
        return recorrenciaParcelaAtual;
    }

    public void setRecorrenciaParcelaAtual(Integer recorrenciaParcelaAtual) {
        this.recorrenciaParcelaAtual = recorrenciaParcelaAtual;
    }

    public Boolean getRecorrenciaValorFixo() {
        return recorrenciaValorFixo;
    }

    public void setRecorrenciaValorFixo(Boolean recorrenciaValorFixo) {
        this.recorrenciaValorFixo = recorrenciaValorFixo;
    }

    public String getRecorrenciaDescricaoPadrao() {
        return recorrenciaDescricaoPadrao;
    }

    public void setRecorrenciaDescricaoPadrao(String recorrenciaDescricaoPadrao) {
        this.recorrenciaDescricaoPadrao = recorrenciaDescricaoPadrao;
    }

    public Long getRecorrenciaPagamentoOrigemId() {
        return recorrenciaPagamentoOrigemId;
    }

    public void setRecorrenciaPagamentoOrigemId(Long recorrenciaPagamentoOrigemId) {
        this.recorrenciaPagamentoOrigemId = recorrenciaPagamentoOrigemId;
    }
}
