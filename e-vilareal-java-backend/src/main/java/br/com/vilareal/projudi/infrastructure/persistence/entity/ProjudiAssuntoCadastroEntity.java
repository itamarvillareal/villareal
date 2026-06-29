package br.com.vilareal.projudi.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "projudi_assunto_cadastro")
@Getter
@Setter
public class ProjudiAssuntoCadastroEntity {

    @Id
    @Column(name = "id_assunto", nullable = false)
    private Integer idAssunto;

    @Column(nullable = false, length = 500)
    private String descricao;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", insertable = false, updatable = false)
    private Instant atualizadoEm;
}
