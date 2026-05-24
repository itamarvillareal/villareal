package br.com.vilareal.topicos.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "topico")
@Getter
@Setter
public class TopicoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String categoria;

    @Column(length = 200)
    private String subcategoria;

    @Column(nullable = false, length = 300)
    private String nome;

    @Column(name = "chave_navegacao", nullable = false, length = 500, unique = true)
    private String chaveNavegacao;

    @Column(name = "conteudo_template", nullable = false, columnDefinition = "LONGTEXT")
    private String conteudoTemplate;

    @Column(name = "tipo_formatacao", length = 50)
    private String tipoFormatacao;

    @Column(nullable = false)
    private Integer ordem = 0;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
