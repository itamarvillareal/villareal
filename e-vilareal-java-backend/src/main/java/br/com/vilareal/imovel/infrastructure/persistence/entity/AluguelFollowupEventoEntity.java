package br.com.vilareal.imovel.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Evento manual do follow-up de cobrança de aluguel (contrato × competência):
 * LIGACAO, ANOTACAO, ADIAR (com {@code adiadoAte}) ou RESOLVIDO_MANUAL.
 * O restante do estado do caso é derivado (envios WhatsApp, resposta, pagamento).
 */
@Entity
@Table(name = "aluguel_followup_evento")
@Getter
@Setter
public class AluguelFollowupEventoEntity {

    public static final String TIPO_LIGACAO = "LIGACAO";
    public static final String TIPO_ANOTACAO = "ANOTACAO";
    public static final String TIPO_ADIAR = "ADIAR";
    public static final String TIPO_RESOLVIDO_MANUAL = "RESOLVIDO_MANUAL";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "contrato_id", nullable = false)
    private Long contratoId;

    @Column(name = "competencia", columnDefinition = "char(7)", nullable = false)
    private String competencia;

    @Column(name = "tipo", length = 20, nullable = false)
    private String tipo;

    @Column(name = "observacao", length = 500)
    private String observacao;

    @Column(name = "adiado_ate")
    private LocalDate adiadoAte;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
