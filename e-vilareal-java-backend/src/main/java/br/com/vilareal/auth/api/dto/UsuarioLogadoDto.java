package br.com.vilareal.auth.api.dto;

import java.util.List;

public class UsuarioLogadoDto {

    private Long id;
    private String nome;
    private String login;
    private List<Long> perfilIds;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getLogin() {
        return login;
    }

    public void setLogin(String login) {
        this.login = login;
    }

    public List<Long> getPerfilIds() {
        return perfilIds;
    }

    public void setPerfilIds(List<Long> perfilIds) {
        this.perfilIds = perfilIds;
    }
}
