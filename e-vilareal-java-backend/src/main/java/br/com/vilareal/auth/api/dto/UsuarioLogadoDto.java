package br.com.vilareal.auth.api.dto;

public class UsuarioLogadoDto {

    private Long id;
    /** Texto para exibição no cliente: apelido ou login (não é o nome civil completo do cadastro). */
    private String nome;
    private String login;
    private Long perfilId;

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

    public Long getPerfilId() {
        return perfilId;
    }

    public void setPerfilId(Long perfilId) {
        this.perfilId = perfilId;
    }
}
