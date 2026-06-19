package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "financeiro_compensacao_par_descarte")
@Getter
@Setter
public class CompensacaoParDescarteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "lancamento_id_menor", nullable = false)
    private Long lancamentoIdMenor;

    @Column(name = "lancamento_id_maior", nullable = false)
    private Long lancamentoIdMaior;

    @Column(name = "criado_em", nullable = false)
    private Instant criadoEm = Instant.now();
}
