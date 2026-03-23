package br.com.vilareal.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public class ProcessoAndamentoRequest {
    @NotNull
    private LocalDateTime movimentoEm;

    @NotBlank
    private String titulo;

    private String detalhe;

    private String origem;

    private Boolean origemAutomatica;

    private Long usuarioId;

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
}
