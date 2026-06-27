package br.com.vilareal.configuracao.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "sistema_config")
@Getter
@Setter
public class SistemaConfigEntity {

    @Id
    @Column(length = 120, nullable = false)
    private String chave;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String valor;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", insertable = false, updatable = false)
    private Instant atualizadoEm;
}
