package br.com.vilareal.usuario.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Usuário (sem senha)")
public class UsuarioResponse {

    private Long id;
    private Long pessoaId;
    /** Nome civil no Cadastro de Pessoas (espelho de {@code pessoa.nome}), quando há vínculo. */
    private String nomePessoa;
    private String nome;
    private String apelido;
    private String login;
    private Boolean ativo;
    private Long perfilId;

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

    public String getNomePessoa() {
        return nomePessoa;
    }

    public void setNomePessoa(String nomePessoa) {
        this.nomePessoa = nomePessoa;
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

    public Long getPerfilId() {
        return perfilId;
    }

    public void setPerfilId(Long perfilId) {
        this.perfilId = perfilId;
    }
}
