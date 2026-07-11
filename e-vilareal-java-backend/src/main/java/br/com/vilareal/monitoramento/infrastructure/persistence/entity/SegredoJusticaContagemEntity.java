package br.com.vilareal.monitoramento.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.time.Instant;

/**
 * Contagem de linhas em segredo de justiça por (pessoa, serventia). Linhas de segredo são
 * opacas (sem número/partes) e não deduplicam; aumento na contagem gera alerta manual.
 */
@Entity
@Table(name = "segredo_justica_contagem")
@IdClass(SegredoJusticaContagemEntity.Pk.class)
@Getter
@Setter
public class SegredoJusticaContagemEntity {

    @Id
    @Column(name = "pessoa_id")
    private Long pessoaId;

    @Id
    @Column(length = 255)
    private String serventia;

    @Column(nullable = false)
    private Integer qtd = 0;

    @Column(name = "atualizado_em", insertable = false, updatable = false)
    private Instant atualizadoEm;

    @NoArgsConstructor
    @Getter
    @Setter
    @EqualsAndHashCode
    public static class Pk implements Serializable {
        private Long pessoaId;
        private String serventia;

        public Pk(Long pessoaId, String serventia) {
            this.pessoaId = pessoaId;
            this.serventia = serventia;
        }
    }
}
