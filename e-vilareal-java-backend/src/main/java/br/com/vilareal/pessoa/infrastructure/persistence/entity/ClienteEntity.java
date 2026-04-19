package br.com.vilareal.pessoa.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "cliente")
@Getter
@Setter
public class ClienteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Alinhado a {@code CHAR(8)} em {@code V10__cliente.sql} (Hibernate: {@code length} sozinho tende a VARCHAR e falha em validate). */
    @Column(name = "codigo_cliente", nullable = false, columnDefinition = "CHAR(8)")
    private String codigoCliente;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pessoa_id", nullable = false)
    private PessoaEntity pessoa;

    @Column(name = "nome_referencia", length = 255)
    private String nomeReferencia;

    @Column(name = "documento_referencia", length = 20)
    private String documentoReferencia;

    @Column(columnDefinition = "TEXT")
    private String observacao;

    @Column(nullable = false)
    private Boolean inativo = false;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
