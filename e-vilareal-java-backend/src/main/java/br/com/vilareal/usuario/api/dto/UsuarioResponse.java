package br.com.vilareal.usuario.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Usuário (sem senha)")
public class UsuarioResponse {

    private Long id;
    private Long pessoaId;
    private String nome;
    private String apelido;
    private String login;
    private Boolean ativo;
    private List<Long> perfilIds;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getPessoaId() {
        return pessoaId;
    }

    public void setPessoaId(Long pessoaId) {
        this.pessoaId = pessoaId;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getApelido() {
        return apelido;
    }

    public void setApelido(String apelido) {
        this.apelido = apelido;
    }

    public String getLogin() {
        return login;
    }

    public void setLogin(String login) {
        this.login = login;
    }

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }

    public List<Long> getPerfilIds() {
        return perfilIds;
    }

    public void setPerfilIds(List<Long> perfilIds) {
        this.perfilIds = perfilIds;
    }
}
