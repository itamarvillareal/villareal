package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "financeiro_cartao")
@Getter
@Setter
public class CartaoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String nome;

    @Column(name = "numero_cartao", nullable = false)
    private Integer numeroCartao;

    @Column(nullable = false)
    private Boolean ativo = true;

    @Column(name = "ordem_exibicao", nullable = false)
    private Integer ordemExibicao = 0;
}
