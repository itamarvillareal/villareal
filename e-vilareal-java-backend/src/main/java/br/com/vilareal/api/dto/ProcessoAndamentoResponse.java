package br.com.vilareal.api.dto;

import java.time.LocalDateTime;

public class ProcessoAndamentoResponse {
    private Long id;
    private Long processoId;
    private LocalDateTime movimentoEm;
    private String titulo;
    private String detalhe;
    private String origem;
    private Boolean origemAutomatica;
    private Long usuarioId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getProcessoId() { return processoId; }
    public void setProcessoId(Long processoId) { this.processoId = processoId; }
    public LocalDateTime getMovimentoEm() { return movimentoEm; }
    public void setMovimentoEm(LocalDateTime movimentoEm) { this.movimentoEm = movimentoEm; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getDetalhe() { return detalhe; }
    public void setDetalhe(String detalhe) { this.detalhe = detalhe; }
    public String getOrigem() { return origem; }
    public void setOrigem(String origem) { this.origem = origem; }
    public Boolean getOrigemAutomatica() { return origemAutomatica; }
    public void setOrigemAutomatica(Boolean origemAutomatica) { this.origemAutomatica = origemAutomatica; }
    public Long getUsuarioId() { return usuarioId; }
    public void setUsuarioId(Long usuarioId) { this.usuarioId = usuarioId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
