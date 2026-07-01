package br.com.vilareal.whatsapp.infrastructure.persistence.entity;

import br.com.vilareal.whatsapp.ScheduledMessageStatus;
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

import java.time.Instant;

@Entity
@Table(name = "scheduled_whatsapp_messages")
@Getter
@Setter
public class ScheduledWhatsAppMessageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "phone_number", nullable = false, length = 20)
    private String phoneNumber;

    @Column(name = "template_name", nullable = false, length = 100)
    private String templateName;

    @Column(name = "template_params", columnDefinition = "TEXT")
    private String templateParams;

    @Column(name = "scheduled_at", nullable = false)
    private Instant scheduledAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 15)
    private ScheduledMessageStatus status = ScheduledMessageStatus.PENDING;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @Column(name = "retry_count", nullable = false)
    private int retryCount = 0;

    @Column(name = "cliente_id")
    private Long clienteId;

    @Column(name = "processo_id")
    private Long processoId;

    @Column(name = "pagamento_id")
    private Long pagamentoId;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "descricao", length = 255)
    private String descricao;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
