package br.com.vilareal.pessoa.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "cliente_whatsapp")
@Getter
@Setter
public class ClienteWhatsAppEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cliente_id", nullable = false)
    private ClienteEntity cliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pessoa_id")
    private PessoaEntity pessoa;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pessoa_contato_id")
    private PessoaContatoEntity pessoaContato;

    @Column(nullable = false, length = 20)
    private String numero;

    @Column(name = "nome_label", length = 120)
    private String nomeLabel;

    @Column(nullable = false)
    private Boolean principal = false;

    @Column(name = "preenchido_automaticamente", nullable = false)
    private Boolean preenchidoAutomaticamente = false;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
