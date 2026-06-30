package br.com.vilareal.whatsapp.infrastructure.persistence.entity;

import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.WhatsAppMessageStatus;
import br.com.vilareal.whatsapp.WhatsAppMessageType;
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
@Table(name = "whatsapp_messages")
@Getter
@Setter
public class WhatsAppMessageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "wa_message_id", length = 255, unique = true)
    private String waMessageId;

    @Column(name = "phone_number", nullable = false, length = 20)
    private String phoneNumber;

    @Column(name = "contact_name", length = 255)
    private String contactName;

    @Enumerated(EnumType.STRING)
    @Column(name = "direction", nullable = false, length = 10)
    private WhatsAppMessageDirection direction;

    @Enumerated(EnumType.STRING)
    @Column(name = "message_type", nullable = false, length = 20)
    private WhatsAppMessageType messageType;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "template_name", length = 100)
    private String templateName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 15)
    private WhatsAppMessageStatus status;

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @Column(name = "cliente_id")
    private Long clienteId;

    @Column(name = "processo_id")
    private Long processoId;

    @Column(name = "media_id", length = 255)
    private String mediaId;

    @Column(name = "media_mime_type", length = 100)
    private String mediaMimeType;

    @Column(name = "media_filename", length = 255)
    private String mediaFilename;

    @Column(name = "media_drive_url", length = 500)
    private String mediaDriveUrl;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
