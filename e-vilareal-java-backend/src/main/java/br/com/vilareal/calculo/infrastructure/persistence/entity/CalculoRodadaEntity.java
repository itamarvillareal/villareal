package br.com.vilareal.calculo.infrastructure.persistence.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "calculo_rodada")
@Getter
@Setter
public class CalculoRodadaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "codigo_cliente", nullable = false, length = 8)
    private String codigoCliente;

    @Column(name = "numero_processo", nullable = false)
    private Integer numeroProcesso;

    @Column(nullable = false)
    private Integer dimensao = 0;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload_json", nullable = false, columnDefinition = "json")
    private JsonNode payloadJson;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
