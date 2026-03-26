package br.com.vilareal.topicos.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "topico_hierarquia")
@Getter
@Setter
public class TopicoHierarquiaEntity {

    @Id
    private Integer id;

    @Column(name = "raiz_json", nullable = false, columnDefinition = "LONGTEXT")
    private String raizJson;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
