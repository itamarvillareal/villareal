package br.com.vilareal.pessoa.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

@Schema(description = "Pessoa cadastrada (resposta)")
public class PessoaCadastroResponse {

    private Long id;
    private String nome;
    private String email;
    private String cpf;
    private String telefone;
    private LocalDate dataNascimento;
    private Boolean ativo;
    private Boolean marcadoMonitoramento;
    private Long responsavelId;
    private PessoaResponsavelResumo responsavel;

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

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getCpf() {
        return cpf;
    }

    public void setCpf(String cpf) {
        this.cpf = cpf;
    }

    public String getTelefone() {
        return telefone;
    }

    public void setTelefone(String telefone) {
        this.telefone = telefone;
    }

    public LocalDate getDataNascimento() {
        return dataNascimento;
    }

    public void setDataNascimento(LocalDate dataNascimento) {
        this.dataNascimento = dataNascimento;
    }

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }

    public Boolean getMarcadoMonitoramento() {
        return marcadoMonitoramento;
    }

    public void setMarcadoMonitoramento(Boolean marcadoMonitoramento) {
        this.marcadoMonitoramento = marcadoMonitoramento;
    }

    public Long getResponsavelId() {
        return responsavelId;
    }

    public void setResponsavelId(Long responsavelId) {
        this.responsavelId = responsavelId;
    }

    public PessoaResponsavelResumo getResponsavel() {
        return responsavel;
    }

    public void setResponsavel(PessoaResponsavelResumo responsavel) {
        this.responsavel = responsavel;
    }
}
