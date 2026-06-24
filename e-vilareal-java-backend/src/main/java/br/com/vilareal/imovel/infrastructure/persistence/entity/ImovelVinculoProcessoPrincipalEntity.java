package br.com.vilareal.imovel.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "imovel_vinculo_processo_principal")
@Getter
@Setter
public class ImovelVinculoProcessoPrincipalEntity {

    @Id
    @Column(name = "numero_planilha", nullable = false)
    private Integer numeroPlanilha;

    @Column(name = "codigo_cliente", nullable = false, columnDefinition = "CHAR(8)")
    private String codigoCliente;

    @Column(name = "numero_interno", nullable = false)
    private Integer numeroInterno;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
