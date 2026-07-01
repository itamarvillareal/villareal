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

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "whatsapp_cobrancas")
@Getter
@Setter
public class CobrancaWhatsAppEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "lote_id", length = 36, nullable = false)
    private String loteId;

    @Column(name = "lote_descricao", length = 255)
    private String loteDescricao;

    @Column(name = "pessoa_id")
    private Long pessoaId;

    @Column(name = "cliente_id")
    private Long clienteId;

    @Column(name = "pessoa_nome", length = 255)
    private String pessoaNome;

    @Column(name = "phone_number", length = 20, nullable = false)
    private String phoneNumber;

    @Column(name = "imovel_id")
    private Long imovelId;

    @Column(name = "condominio_nome", length = 255)
    private String condominioNome;

    @Column(name = "unidade_descricao", length = 255)
    private String unidadeDescricao;

    @Column(name = "processo_id")
    private Long processoId;

    @Column(name = "valor_pendente", precision = 15, scale = 2)
    private BigDecimal valorPendente;

    @Column(name = "status", length = 15, nullable = false)
    private String status = "PENDENTE";

    @Column(name = "wa_message_id", length = 255)
    private String waMessageId;

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @Column(name = "enviado_at")
    private Instant enviadoAt;

    /** Horário programado para envio (lotes com status AGENDADO). */
    @Column(name = "scheduled_at")
    private Instant scheduledAt;

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
