package br.com.vilareal.totp.infrastructure.persistence.entity;

import br.com.vilareal.totp.domain.TotpAlgoritmo;
import br.com.vilareal.totp.domain.TribunalIntegracao;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * Segredo TOTP cifrado por tribunal + login. O secret Base32 nunca é exposto em API nem logs.
 */
@Entity
@Table(name = "credencial_totp")
@Getter
@Setter
public class CredencialTotpEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "tribunal", length = 40, nullable = false)
    private TribunalIntegracao tribunal;

    @Column(name = "login", length = 120, nullable = false)
    private String login;

    /** Base64(IV || ciphertext AES-GCM). */
    @Column(name = "secret_criptografado", length = 1024, nullable = false)
    private String secretCriptografado;

    /** Senha do 1º fator (PJe) — mesmo layout de cifragem; nunca exposta em API/logs. */
    @Column(name = "senha_criptografada", length = 1024)
    private String senhaCriptografada;

    @Enumerated(EnumType.STRING)
    @Column(name = "algoritmo", length = 16, nullable = false)
    private TotpAlgoritmo algoritmo = TotpAlgoritmo.SHA1;

    @Column(name = "digitos", nullable = false)
    private int digitos = 6;

    @Column(name = "periodo_segundos", nullable = false)
    private int periodoSegundos = 30;

    @Column(name = "issuer", length = 120)
    private String issuer;

    @Column(name = "account_name", length = 200)
    private String accountName;

    @Column(name = "ativo", nullable = false)
    private boolean ativo = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
