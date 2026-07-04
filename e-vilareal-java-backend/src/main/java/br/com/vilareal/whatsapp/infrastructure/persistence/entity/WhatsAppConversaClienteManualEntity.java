package br.com.vilareal.whatsapp.infrastructure.persistence.entity;

import br.com.vilareal.whatsapp.ConversaClienteManualAcao;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(
        name = "whatsapp_conversa_cliente_manual",
        uniqueConstraints = @UniqueConstraint(columnNames = {"phone_number", "cliente_codigo"}))
@Getter
@Setter
public class WhatsAppConversaClienteManualEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "phone_number", nullable = false, length = 20)
    private String phoneNumber;

    @Column(name = "cliente_codigo", nullable = false, columnDefinition = "CHAR(8)")
    private String clienteCodigo;

    @Column(name = "cliente_nome", nullable = false, length = 255)
    private String clienteNome;

    @Enumerated(EnumType.STRING)
    @Column(name = "acao", nullable = false, length = 10)
    private ConversaClienteManualAcao acao;

    @Column(name = "criado_por", nullable = false, length = 100)
    private String criadoPor;

    @Column(name = "criado_em", nullable = false)
    private Instant criadoEm;
}
