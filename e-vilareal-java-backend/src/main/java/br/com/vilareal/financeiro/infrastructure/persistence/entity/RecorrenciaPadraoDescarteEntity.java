package br.com.vilareal.financeiro.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "financeiro_recorrencia_descarte")
@Getter
@Setter
public class RecorrenciaPadraoDescarteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "descricao_norm", nullable = false, length = 255)
    private String descricaoNorm;

    @Column(name = "numero_banco", nullable = false)
    private Integer numeroBanco;

    /** Null = descarte do padrão inteiro; preenchido = descarte só do vínculo sugerido. */
    @Column(name = "somente_vinculo", nullable = false)
    private boolean somenteVinculo;

    @Column(name = "cliente_id", nullable = false)
    private Long clienteId = 0L;

    @Column(name = "processo_id", nullable = false)
    private Long processoId = 0L;

    @Column(name = "criado_em", nullable = false)
    private Instant criadoEm = Instant.now();
}
