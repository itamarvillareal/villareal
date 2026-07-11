package br.com.vilareal.pessoa.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.time.LocalDateTime;

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
    /** Consentimento explícito para aviso de processo novo (Bloco OPT-IN). */
    private Boolean aceitaAvisoProcessoNovo;
    private LocalDateTime avisoConsentimentoEm;
    private String avisoConsentimentoOrigem;
    /** Polo vigiado na varredura PROJUDI: ATIVO, PASSIVO ou AMBOS. */
    private String poloMonitorado;

    public String getPoloMonitorado() {
        return poloMonitorado;
    }

    public void setPoloMonitorado(String poloMonitorado) {
        this.poloMonitorado = poloMonitorado;
    }

    public Boolean getAceitaAvisoProcessoNovo() {
        return aceitaAvisoProcessoNovo;
    }

    public void setAceitaAvisoProcessoNovo(Boolean aceitaAvisoProcessoNovo) {
        this.aceitaAvisoProcessoNovo = aceitaAvisoProcessoNovo;
    }

    public LocalDateTime getAvisoConsentimentoEm() {
        return avisoConsentimentoEm;
    }

    public void setAvisoConsentimentoEm(LocalDateTime avisoConsentimentoEm) {
        this.avisoConsentimentoEm = avisoConsentimentoEm;
    }

    public String getAvisoConsentimentoOrigem() {
        return avisoConsentimentoOrigem;
    }

    public void setAvisoConsentimentoOrigem(String avisoConsentimentoOrigem) {
        this.avisoConsentimentoOrigem = avisoConsentimentoOrigem;
    }

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
