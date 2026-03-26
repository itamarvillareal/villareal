package br.com.vilareal.processo.api.dto;

import java.time.Instant;

public class ProcessoAndamentoResponse {

    private Long id;
    private Instant movimentoEm;
    private String titulo;
    private String detalhe;
    private String origem;
    private Boolean origemAutomatica;
    private Long usuarioId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Instant getMovimentoEm() {
        return movimentoEm;
    }

    public void setMovimentoEm(Instant movimentoEm) {
        this.movimentoEm = movimentoEm;
    }

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
    }

    public String getDetalhe() {
        return detalhe;
    }

    public void setDetalhe(String detalhe) {
        this.detalhe = detalhe;
    }

    public String getOrigem() {
        return origem;
    }

    public void setOrigem(String origem) {
        this.origem = origem;
    }

    public Boolean getOrigemAutomatica() {
        return origemAutomatica;
    }

    public void setOrigemAutomatica(Boolean origemAutomatica) {
        this.origemAutomatica = origemAutomatica;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(Long usuarioId) {
        this.usuarioId = usuarioId;
    }
}
