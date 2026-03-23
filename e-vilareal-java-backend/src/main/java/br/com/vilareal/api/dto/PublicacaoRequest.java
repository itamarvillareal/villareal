package br.com.vilareal.api.dto;

import br.com.vilareal.api.entity.enums.PublicacaoOrigemImportacao;
import br.com.vilareal.api.entity.enums.PublicacaoStatusTratamento;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public class PublicacaoRequest {
    @NotBlank
    @Size(max = 32)
    private String numeroProcessoEncontrado;
    private Long processoId;
    private Long clienteId;
    private Long usuarioResponsavelId;
    private Long monitoringHitId;
    private LocalDate dataDisponibilizacao;
    private LocalDate dataPublicacao;
    @Size(max = 120)
    private String fonte;
    @Size(max = 200)
    private String diario;
    @Size(max = 80)
    private String edicao;
    @Size(max = 120)
    private String caderno;
    @Size(max = 40)
    private String pagina;
    @Size(max = 255)
    private String titulo;
    @Size(max = 80)
    private String tipoPublicacao;
    private String resumo;
    @NotBlank
    private String teor;
    @Size(max = 40)
    private String statusValidacaoCnj;
    @Size(max = 16)
    private String scoreConfianca;
    @NotBlank
    @Size(max = 128)
    private String hashTeor;
    @Size(max = 128)
    private String hashConteudo;
    @NotNull
    private PublicacaoOrigemImportacao origemImportacao = PublicacaoOrigemImportacao.MANUAL;
    @Size(max = 255)
    private String arquivoOrigemNome;
    @Size(max = 128)
    private String arquivoOrigemHash;
    private String jsonReferencia;
    private PublicacaoStatusTratamento statusTratamento;
    private Boolean lida;
    private String observacao;

    public String getNumeroProcessoEncontrado() { return numeroProcessoEncontrado; }
    public void setNumeroProcessoEncontrado(String numeroProcessoEncontrado) { this.numeroProcessoEncontrado = numeroProcessoEncontrado; }
    public Long getProcessoId() { return processoId; }
    public void setProcessoId(Long processoId) { this.processoId = processoId; }
    public Long getClienteId() { return clienteId; }
    public void setClienteId(Long clienteId) { this.clienteId = clienteId; }
    public Long getUsuarioResponsavelId() { return usuarioResponsavelId; }
    public void setUsuarioResponsavelId(Long usuarioResponsavelId) { this.usuarioResponsavelId = usuarioResponsavelId; }
    public Long getMonitoringHitId() { return monitoringHitId; }
    public void setMonitoringHitId(Long monitoringHitId) { this.monitoringHitId = monitoringHitId; }
    public LocalDate getDataDisponibilizacao() { return dataDisponibilizacao; }
    public void setDataDisponibilizacao(LocalDate dataDisponibilizacao) { this.dataDisponibilizacao = dataDisponibilizacao; }
    public LocalDate getDataPublicacao() { return dataPublicacao; }
    public void setDataPublicacao(LocalDate dataPublicacao) { this.dataPublicacao = dataPublicacao; }
    public String getFonte() { return fonte; }
    public void setFonte(String fonte) { this.fonte = fonte; }
    public String getDiario() { return diario; }
    public void setDiario(String diario) { this.diario = diario; }
    public String getEdicao() { return edicao; }
    public void setEdicao(String edicao) { this.edicao = edicao; }
    public String getCaderno() { return caderno; }
    public void setCaderno(String caderno) { this.caderno = caderno; }
    public String getPagina() { return pagina; }
    public void setPagina(String pagina) { this.pagina = pagina; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getTipoPublicacao() { return tipoPublicacao; }
    public void setTipoPublicacao(String tipoPublicacao) { this.tipoPublicacao = tipoPublicacao; }
    public String getResumo() { return resumo; }
    public void setResumo(String resumo) { this.resumo = resumo; }
    public String getTeor() { return teor; }
    public void setTeor(String teor) { this.teor = teor; }
    public String getStatusValidacaoCnj() { return statusValidacaoCnj; }
    public void setStatusValidacaoCnj(String statusValidacaoCnj) { this.statusValidacaoCnj = statusValidacaoCnj; }
    public String getScoreConfianca() { return scoreConfianca; }
    public void setScoreConfianca(String scoreConfianca) { this.scoreConfianca = scoreConfianca; }
    public String getHashTeor() { return hashTeor; }
    public void setHashTeor(String hashTeor) { this.hashTeor = hashTeor; }
    public String getHashConteudo() { return hashConteudo; }
    public void setHashConteudo(String hashConteudo) { this.hashConteudo = hashConteudo; }
    public PublicacaoOrigemImportacao getOrigemImportacao() { return origemImportacao; }
    public void setOrigemImportacao(PublicacaoOrigemImportacao origemImportacao) { this.origemImportacao = origemImportacao; }
    public String getArquivoOrigemNome() { return arquivoOrigemNome; }
    public void setArquivoOrigemNome(String arquivoOrigemNome) { this.arquivoOrigemNome = arquivoOrigemNome; }
    public String getArquivoOrigemHash() { return arquivoOrigemHash; }
    public void setArquivoOrigemHash(String arquivoOrigemHash) { this.arquivoOrigemHash = arquivoOrigemHash; }
    public String getJsonReferencia() { return jsonReferencia; }
    public void setJsonReferencia(String jsonReferencia) { this.jsonReferencia = jsonReferencia; }
    public PublicacaoStatusTratamento getStatusTratamento() { return statusTratamento; }
    public void setStatusTratamento(PublicacaoStatusTratamento statusTratamento) { this.statusTratamento = statusTratamento; }
    public Boolean getLida() { return lida; }
    public void setLida(Boolean lida) { this.lida = lida; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String observacao) { this.observacao = observacao; }
}
