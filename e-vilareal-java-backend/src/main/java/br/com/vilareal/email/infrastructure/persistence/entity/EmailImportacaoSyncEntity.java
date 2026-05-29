package br.com.vilareal.email.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "email_importacao_sync")
@Getter
@Setter
public class EmailImportacaoSyncEntity {

    @Id
    @Column(name = "tipo", length = 32, nullable = false)
    private String tipo;

    @Column(name = "ultima_sincronizacao_em", nullable = false)
    private Instant ultimaSincronizacaoEm;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
