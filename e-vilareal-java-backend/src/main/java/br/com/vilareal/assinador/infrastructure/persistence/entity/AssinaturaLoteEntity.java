package br.com.vilareal.assinador.infrastructure.persistence.entity;

import br.com.vilareal.assinador.domain.AssinaturaLoteStatus;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "assinatura_lote")
@Getter
@Setter
public class AssinaturaLoteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private AssinaturaLoteStatus status = AssinaturaLoteStatus.LIBERADO;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "peticao_ids", nullable = false, columnDefinition = "json")
    private List<Long> peticaoIds = new ArrayList<>();

    @Column(name = "credencial_id", nullable = false)
    private Long credencialId;

    @Column(name = "erro_codigo", length = 60)
    private String erroCodigo;

    @Column(name = "erro_mensagem", columnDefinition = "TEXT")
    private String erroMensagem;

    @Column(name = "locked_at")
    private Instant lockedAt;

    @Column(name = "locked_by", length = 120)
    private String lockedBy;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "resultado_json", columnDefinition = "json")
    private JsonNode resultadoJson;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", insertable = false, updatable = false)
    private Instant atualizadoEm;
}
