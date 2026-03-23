package br.com.vilareal.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class ContaContabilRequest {
    @NotBlank
    @Size(max = 10)
    private String codigo;

    @NotBlank
    @Size(max = 120)
    private String nome;

    @NotBlank
    @Size(max = 30)
    private String tipo;

    @Size(max = 20)
    private String naturezaPadrao;

    @Size(max = 80)
    private String grupoContabil;

    @NotNull
    private Boolean aceitaVinculoProcesso;

    @NotNull
    private Boolean aceitaCompensacao;

    @NotNull
    private Boolean ativa;

    private Integer ordemExibicao;

    public String getCodigo() { return codigo; }
    public void setCodigo(String codigo) { this.codigo = codigo; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }
    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }
    public String getNaturezaPadrao() { return naturezaPadrao; }
    public void setNaturezaPadrao(String naturezaPadrao) { this.naturezaPadrao = naturezaPadrao; }
    public String getGrupoContabil() { return grupoContabil; }
    public void setGrupoContabil(String grupoContabil) { this.grupoContabil = grupoContabil; }
    public Boolean getAceitaVinculoProcesso() { return aceitaVinculoProcesso; }
    public void setAceitaVinculoProcesso(Boolean aceitaVinculoProcesso) { this.aceitaVinculoProcesso = aceitaVinculoProcesso; }
    public Boolean getAceitaCompensacao() { return aceitaCompensacao; }
    public void setAceitaCompensacao(Boolean aceitaCompensacao) { this.aceitaCompensacao = aceitaCompensacao; }
    public Boolean getAtiva() { return ativa; }
    public void setAtiva(Boolean ativa) { this.ativa = ativa; }
    public Integer getOrdemExibicao() { return ordemExibicao; }
    public void setOrdemExibicao(Integer ordemExibicao) { this.ordemExibicao = ordemExibicao; }
}
