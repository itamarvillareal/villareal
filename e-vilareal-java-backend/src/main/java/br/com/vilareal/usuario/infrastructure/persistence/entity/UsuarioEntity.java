package br.com.vilareal.usuario.infrastructure.persistence.entity;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "usuarios")
@Getter
@Setter
public class UsuarioEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pessoa_id", nullable = false)
    private PessoaEntity pessoa;

    @Column(nullable = false, length = 255)
    private String nome;

    @Column(length = 120)
    private String apelido;

    @Column(nullable = false, unique = true, length = 120)
    private String login;

    @Column(name = "senha_hash", nullable = false, length = 255)
    private String senhaHash;

    @Column(nullable = false)
    private Boolean ativo = true;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "perfil_id", nullable = false)
    private PerfilEntity perfil;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
