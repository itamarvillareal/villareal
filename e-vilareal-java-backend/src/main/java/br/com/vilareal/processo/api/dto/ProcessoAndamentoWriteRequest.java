package br.com.vilareal.processo.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public class ProcessoAndamentoWriteRequest {

    private Instant movimentoEm;

    @NotBlank
    @Size(max = 500)
    private String titulo;

    private String detalhe;

    private String origem = "MANUAL";

    private Boolean origemAutomatica = false;

    private Long usuarioId;

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
