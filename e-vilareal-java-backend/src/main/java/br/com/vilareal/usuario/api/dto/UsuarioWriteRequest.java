package br.com.vilareal.usuario.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Criação/atualização de usuário (paridade usuariosRepository + ModalDadosUsuario)")
public class UsuarioWriteRequest {

    @Schema(description = "ID da pessoa (nº da ficha)")
    private Long pessoaId;

    @NotBlank
    @Size(max = 255)
    private String nome;

    @Schema(description = "Nome de exibição no sistema. Obrigatório ao criar usuário (POST).")
    @Size(max = 120)
    private String apelido;

    @NotBlank
    @Size(max = 120)
    private String login;

    private Boolean ativo = true;

    @Schema(description = "Senha em texto (recomendado). Mín. 4 caracteres se informada.")
    @Size(max = 128)
    private String senha;

    @Schema(description = "Legado: hash BCrypt já calculado (ex.: front antigo). Ignorado se senha for informada.")
    @JsonProperty("senhaHash")
    private String senhaHash;

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
        this.login = login != null ? login.trim().toLowerCase() : null;
    }

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }

    public String getSenha() {
        return senha;
    }

    public void setSenha(String senha) {
        this.senha = senha;
    }

    public String getSenhaHash() {
        return senhaHash;
    }

    public void setSenhaHash(String senhaHash) {
        this.senhaHash = senhaHash;
    }
}
