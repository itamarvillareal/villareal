package br.com.vilareal.api.dto;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class UsuarioResponse {
    private Long id;
    private Long pessoaId;
    private String nome;
    private String apelido;
    private String login;
    private Boolean ativo;
    private LocalDateTime ultimoLoginEm;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<Long> perfilIds = new ArrayList<>();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getPessoaId() { return pessoaId; }
    public void setPessoaId(Long pessoaId) { this.pessoaId = pessoaId; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }
    public String getApelido() { return apelido; }
    public void setApelido(String apelido) { this.apelido = apelido; }
    public String getLogin() { return login; }
    public void setLogin(String login) { this.login = login; }
    public Boolean getAtivo() { return ativo; }
    public void setAtivo(Boolean ativo) { this.ativo = ativo; }
    public LocalDateTime getUltimoLoginEm() { return ultimoLoginEm; }
    public void setUltimoLoginEm(LocalDateTime ultimoLoginEm) { this.ultimoLoginEm = ultimoLoginEm; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public List<Long> getPerfilIds() { return perfilIds; }
    public void setPerfilIds(List<Long> perfilIds) { this.perfilIds = perfilIds; }
}
