package br.com.vilareal.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class PermissaoRequest {
    @NotBlank
    @Size(max = 120)
    private String codigo;

    @NotBlank
    @Size(max = 120)
    private String modulo;

    @Size(max = 500)
    private String descricao;

    public String getCodigo() { return codigo; }
    public void setCodigo(String codigo) { this.codigo = codigo; }
    public String getModulo() { return modulo; }
    public void setModulo(String modulo) { this.modulo = modulo; }
    public String getDescricao() { return descricao; }
    public void setDescricao(String descricao) { this.descricao = descricao; }
}
