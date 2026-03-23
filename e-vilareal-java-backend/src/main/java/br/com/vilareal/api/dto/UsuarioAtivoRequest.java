package br.com.vilareal.api.dto;

import jakarta.validation.constraints.NotNull;

public class UsuarioAtivoRequest {
    @NotNull
    private Boolean ativo;

    public Boolean getAtivo() { return ativo; }
    public void setAtivo(Boolean ativo) { this.ativo = ativo; }
}
