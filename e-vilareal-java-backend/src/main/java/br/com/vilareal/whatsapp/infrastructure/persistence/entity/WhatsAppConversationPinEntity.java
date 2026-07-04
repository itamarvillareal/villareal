package br.com.vilareal.whatsapp.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "whatsapp_conversation_pin")
@Getter
@Setter
public class WhatsAppConversationPinEntity {

    @Id
    @Column(name = "phone_number", length = 20)
    private String phoneNumber;

    @Column(name = "pinned_at", nullable = false)
    private Instant pinnedAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
