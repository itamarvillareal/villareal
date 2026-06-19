package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "financeiro_semelhante_escritorio_descarte")
@Getter
@Setter
public class SemelhanteEscritorioDescarteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "lancamento_id", nullable = false)
    private Long lancamentoId;

    @Column(name = "cliente_id", nullable = false)
    private Long clienteId;

    @Column(name = "processo_id", nullable = false)
    private Long processoId;

    @Column(name = "criado_em", nullable = false)
    private Instant criadoEm = Instant.now();
}
