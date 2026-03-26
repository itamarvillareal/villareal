package br.com.vilareal.calculo.infrastructure.persistence.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "calculo_cliente_config")
@Getter
@Setter
public class CalculoClienteConfigEntity {

    @Id
    @Column(name = "codigo_cliente", length = 8, nullable = false)
    private String codigoCliente;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload_json", nullable = false, columnDefinition = "json")
    private JsonNode payloadJson;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
