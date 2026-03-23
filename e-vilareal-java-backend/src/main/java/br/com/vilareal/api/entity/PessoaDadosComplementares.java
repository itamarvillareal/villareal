package br.com.vilareal.api.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "pessoa_dados_complementares")
public class PessoaDadosComplementares {
    @Id
    @Column(name = "pessoa_id")
    private Long pessoaId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId
    @JoinColumn(name = "pessoa_id", foreignKey = @ForeignKey(name = "fk_pessoa_dados_complementares"))
    private CadastroPessoa pessoa;

    @Column(length = 30)
    private String rg;

    @Column(name = "orgao_expedidor", length = 40)
    private String orgaoExpedidor;

    @Column(length = 120)
    private String profissao;

    @Column(length = 120)
    private String nacionalidade;

    @Column(name = "estado_civil", length = 40)
    private String estadoCivil;

    @Column(length = 20)
    private String genero;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Long getPessoaId() { return pessoaId; }
    public void setPessoaId(Long pessoaId) { this.pessoaId = pessoaId; }
    public CadastroPessoa getPessoa() { return pessoa; }
    public void setPessoa(CadastroPessoa pessoa) { this.pessoa = pessoa; }
    public String getRg() { return rg; }
    public void setRg(String rg) { this.rg = rg; }
    public String getOrgaoExpedidor() { return orgaoExpedidor; }
    public void setOrgaoExpedidor(String orgaoExpedidor) { this.orgaoExpedidor = orgaoExpedidor; }
    public String getProfissao() { return profissao; }
    public void setProfissao(String profissao) { this.profissao = profissao; }
    public String getNacionalidade() { return nacionalidade; }
    public void setNacionalidade(String nacionalidade) { this.nacionalidade = nacionalidade; }
    public String getEstadoCivil() { return estadoCivil; }
    public void setEstadoCivil(String estadoCivil) { this.estadoCivil = estadoCivil; }
    public String getGenero() { return genero; }
    public void setGenero(String genero) { this.genero = genero; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
