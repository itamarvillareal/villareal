package br.com.vilareal.importacao.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "planilha_pasta1_cliente")
@Getter
@Setter
public class PlanilhaPasta1ClienteEntity {

    @Id
    @Column(name = "chave_cliente", length = 128, nullable = false)
    private String chaveCliente;

    @Column(name = "pessoa_id", nullable = false)
    private Long pessoaId;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
