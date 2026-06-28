package br.com.vilareal.localidade.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "estado")
@Getter
@Setter
public class EstadoEntity {

    @Id
    private Integer id;

    @Column(nullable = false, length = 2, columnDefinition = "CHAR(2)")
    private String sigla;

    @Column(nullable = false, length = 120)
    private String nome;
}
