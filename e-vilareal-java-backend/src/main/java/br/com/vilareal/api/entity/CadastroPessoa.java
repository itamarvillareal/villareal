package br.com.vilareal.api.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Entidade que mapeia a tabela cadastro_pessoas do banco de dados.
 * Estrutura: id, nome, email, cpf, telefone, data_nascimento, ativo, data_criacao, data_atualizacao.
 */
@Entity
@Table(name = "cadastro_pessoas", indexes = {
    @Index(name = "idx_cadastro_pessoas_email", columnList = "email"),
    @Index(name = "idx_cadastro_pessoas_cpf", columnList = "cpf"),
    @Index(name = "idx_cadastro_pessoas_ativo", columnList = "ativo"),
    @Index(name = "idx_cadastro_pessoas_responsavel_id", columnList = "responsavel_id")
})
public class CadastroPessoa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String nome;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(nullable = false, unique = true, length = 14)
    private String cpf;

    @Column(length = 20)
    private String telefone;

    @Column(name = "data_nascimento")
    private LocalDate dataNascimento;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Column(name = "data_criacao", updatable = false)
    private LocalDateTime dataCriacao;

    @Column(name = "data_atualizacao")
    private LocalDateTime dataAtualizacao;

    /**
     * Outra pessoa cadastrada como responsável / representante (PJ: sócio; PF: tutor, curador, etc.).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responsavel_id", foreignKey = @ForeignKey(name = "fk_cadastro_pessoas_responsavel"))
    private CadastroPessoa responsavel;

    @PrePersist
    protected void onCreate() {
        dataCriacao = LocalDateTime.now();
        dataAtualizacao = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        dataAtualizacao = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getCpf() { return cpf; }
    public void setCpf(String cpf) { this.cpf = cpf; }
    public String getTelefone() { return telefone; }
    public void setTelefone(String telefone) { this.telefone = telefone; }
    public LocalDate getDataNascimento() { return dataNascimento; }
    public void setDataNascimento(LocalDate dataNascimento) { this.dataNascimento = dataNascimento; }
    public Boolean getAtivo() { return ativo; }
    public void setAtivo(Boolean ativo) { this.ativo = ativo; }
    public LocalDateTime getDataCriacao() { return dataCriacao; }
    public void setDataCriacao(LocalDateTime dataCriacao) { this.dataCriacao = dataCriacao; }
    public LocalDateTime getDataAtualizacao() { return dataAtualizacao; }
    public void setDataAtualizacao(LocalDateTime dataAtualizacao) { this.dataAtualizacao = dataAtualizacao; }
    public CadastroPessoa getResponsavel() { return responsavel; }
    public void setResponsavel(CadastroPessoa responsavel) { this.responsavel = responsavel; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        CadastroPessoa that = (CadastroPessoa) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
