package br.com.vilareal.projudi.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "projudi_assunto_oculto")
@Getter
@Setter
public class ProjudiAssuntoOcultoEntity {

    @Id
    @Column(name = "id_assunto", nullable = false)
    private Integer idAssunto;

    @Column(name = "ocultado_em", insertable = false, updatable = false)
    private Instant ocultadoEm;
}
