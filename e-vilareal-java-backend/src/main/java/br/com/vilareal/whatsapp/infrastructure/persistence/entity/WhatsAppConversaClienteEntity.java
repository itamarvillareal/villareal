package br.com.vilareal.whatsapp.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "whatsapp_conversa_cliente")
@Getter
@Setter
public class WhatsAppConversaClienteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "phone_number", nullable = false, length = 20)
    private String phoneNumber;

    @Column(name = "cliente_codigo", nullable = false, columnDefinition = "CHAR(8)")
    private String clienteCodigo;

    @Column(name = "cliente_nome", nullable = false, length = 255)
    private String clienteNome;

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;
}
