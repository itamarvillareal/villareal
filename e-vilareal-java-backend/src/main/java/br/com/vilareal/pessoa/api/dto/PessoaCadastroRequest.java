package br.com.vilareal.pessoa.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

@Schema(description = "Corpo para criar/atualizar pessoa (paridade clientesService.js)")
public class PessoaCadastroRequest {

    @NotBlank
    @Size(max = 255)
    private String nome;

    @Email
    @Size(max = 255)
    private String email;

    @NotBlank
    @Size(min = 11, max = 14)
    private String cpf;

    @Size(max = 40)
    private String telefone;

    private LocalDate dataNascimento;

    private Boolean ativo = true;

    private Boolean marcadoMonitoramento;

    private Long responsavelId;

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
        this.email = (email == null || email.isBlank()) ? null : email.trim();
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
}
