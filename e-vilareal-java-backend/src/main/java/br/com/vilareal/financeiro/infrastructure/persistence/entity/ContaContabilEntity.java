package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "financeiro_conta_contabil")
@Getter
@Setter
public class ContaContabilEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 4)
    private String codigo;

    @Column(nullable = false, length = 255)
    private String nome;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Column(name = "ordem_exibicao", nullable = false)
    private Integer ordemExibicao = 0;
}
