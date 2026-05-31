package br.com.vilareal.projudi.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * Credencial de login no PROJUDI (CPF + senha de um advogado), com a senha
 * armazenada SOMENTE cifrada. Mapeia a tabela {@code projudi_credencial}.
 *
 * <p><b>Segurança:</b> não há getter de senha em claro. O ciphertext
 * ({@code senhaCifrada}) e o {@code iv} são opacos; a recuperação do plaintext
 * só ocorre via {@code ProjudiCredencialService} (cifragem/decifragem dedicada).</p>
 */
@Entity
@Table(name = "projudi_credencial")
@Getter
@Setter
public class ProjudiCredencialEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id")
    private Long usuarioId;

    @Column(name = "cpf_usuario", length = 14, nullable = false)
    private String cpfUsuario;

    /** Ciphertext autenticado (AES/GCM). Blob opaco; nunca exposto em DTO. */
    @Column(name = "senha_cifrada", nullable = false, length = 512)
    private byte[] senhaCifrada;

    /** Nonce de 12 bytes usado na cifragem desta linha. */
    @Column(name = "iv", nullable = false, length = 32)
    private byte[] iv;

    @Column(name = "rotulo", length = 120)
    private String rotulo;

    @Column(name = "ativo", nullable = false)
    private boolean ativo = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
