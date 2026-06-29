package br.com.vilareal.whatsapp.infrastructure.persistence.entity;

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

@Entity
@Table(name = "whatsapp_aniversarios")
@Getter
@Setter
public class AniversarioWhatsAppEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "pessoa_id", nullable = false)
    private Long pessoaId;

    @Column(name = "pessoa_nome", length = 255)
    private String pessoaNome;

    @Column(name = "phone_number", nullable = false, length = 20)
    private String phoneNumber;

    @Column(name = "data_aniversario", nullable = false)
    private LocalDate dataAniversario;

    @Column(name = "ano_envio", nullable = false)
    private int anoEnvio;

    @Column(name = "wa_message_id", length = 255)
    private String waMessageId;

    @Column(name = "status", nullable = false, length = 15)
    private String status = "SENT";

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (status == null || status.isBlank()) {
            status = "SENT";
        }
    }
}
