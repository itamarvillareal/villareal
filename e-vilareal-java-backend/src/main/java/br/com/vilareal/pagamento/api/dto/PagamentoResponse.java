package br.com.vilareal.pagamento.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public class PagamentoResponse {

    private Long id;
    private LocalDate dataCadastro;
    private LocalDate dataAgendamento;
    private LocalDate dataVencimento;
    private String codigoBarras;
    private BigDecimal valor;
    private String descricao;
    private String categoria;
    private String formaPagamento;
    private Long responsavelUsuarioId;
    private String responsavelNome;
    private String status;
    private String prioridade;
    private String origem;
    private LocalDate dataPagamentoEfetivo;
    private String observacoes;
    private boolean temBoletoAnexo;
    private boolean temComprovanteAnexo;
    private Long clienteId;
    private String clienteCodigo;
    private Long processoId;
    private Integer processoNumeroInterno;
    private Long imovelId;
    private Integer imovelNumeroPlanilha;
    private String condominioTexto;
    private Long contratoLocacaoId;
    private String fornecedorTexto;
    private boolean recorrente;
    private String recorrenciaTipo;
    private Integer recorrenciaQuantidadeParcelas;
    private Integer recorrenciaParcelaAtual;
    private Boolean recorrenciaValorFixo;
    private String recorrenciaDescricaoPadrao;
    private Long recorrenciaPagamentoOrigemId;
    private Long substituidoPorPagamentoId;
    private Instant canceladoEm;
    private Long criadoPorUsuarioId;
    private Long atualizadoPorUsuarioId;
    private Instant criadoEm;
    private Instant atualizadoEm;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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

    public String getResponsavelNome() {
        return responsavelNome;
    }

    public void setResponsavelNome(String responsavelNome) {
        this.responsavelNome = responsavelNome;
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

    public boolean isTemBoletoAnexo() {
        return temBoletoAnexo;
    }

    public void setTemBoletoAnexo(boolean temBoletoAnexo) {
        this.temBoletoAnexo = temBoletoAnexo;
    }

    public boolean isTemComprovanteAnexo() {
        return temComprovanteAnexo;
    }

    public void setTemComprovanteAnexo(boolean temComprovanteAnexo) {
        this.temComprovanteAnexo = temComprovanteAnexo;
    }

    public Long getClienteId() {
        return clienteId;
    }

    public void setClienteId(Long clienteId) {
        this.clienteId = clienteId;
    }

    public String getClienteCodigo() {
        return clienteCodigo;
    }

    public void setClienteCodigo(String clienteCodigo) {
        this.clienteCodigo = clienteCodigo;
    }

    public Long getProcessoId() {
        return processoId;
    }

    public void setProcessoId(Long processoId) {
        this.processoId = processoId;
    }

    public Integer getProcessoNumeroInterno() {
        return processoNumeroInterno;
    }

    public void setProcessoNumeroInterno(Integer processoNumeroInterno) {
        this.processoNumeroInterno = processoNumeroInterno;
    }

    public Long getImovelId() {
        return imovelId;
    }

    public void setImovelId(Long imovelId) {
        this.imovelId = imovelId;
    }

    public Integer getImovelNumeroPlanilha() {
        return imovelNumeroPlanilha;
    }

    public void setImovelNumeroPlanilha(Integer imovelNumeroPlanilha) {
        this.imovelNumeroPlanilha = imovelNumeroPlanilha;
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

    public boolean isRecorrente() {
        return recorrente;
    }

    public void setRecorrente(boolean recorrente) {
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

    public Long getSubstituidoPorPagamentoId() {
        return substituidoPorPagamentoId;
    }

    public void setSubstituidoPorPagamentoId(Long substituidoPorPagamentoId) {
        this.substituidoPorPagamentoId = substituidoPorPagamentoId;
    }

    public Instant getCanceladoEm() {
        return canceladoEm;
    }

    public void setCanceladoEm(Instant canceladoEm) {
        this.canceladoEm = canceladoEm;
    }

    public Long getCriadoPorUsuarioId() {
        return criadoPorUsuarioId;
    }

    public void setCriadoPorUsuarioId(Long criadoPorUsuarioId) {
        this.criadoPorUsuarioId = criadoPorUsuarioId;
    }

    public Long getAtualizadoPorUsuarioId() {
        return atualizadoPorUsuarioId;
    }

    public void setAtualizadoPorUsuarioId(Long atualizadoPorUsuarioId) {
        this.atualizadoPorUsuarioId = atualizadoPorUsuarioId;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public void setCriadoEm(Instant criadoEm) {
        this.criadoEm = criadoEm;
    }

    public Instant getAtualizadoEm() {
        return atualizadoEm;
    }

    public void setAtualizadoEm(Instant atualizadoEm) {
        this.atualizadoEm = atualizadoEm;
    }
}
