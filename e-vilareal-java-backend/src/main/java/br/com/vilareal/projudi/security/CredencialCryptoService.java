package br.com.vilareal.projudi.security;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Cifragem/decifragem das senhas do cofre PROJUDI.
 *
 * <p>Algoritmo: <b>AES/GCM/NoPadding</b>, tag de autenticação de 128 bits e
 * IV (nonce) de 12 bytes gerado aleatoriamente <b>a cada gravação</b>. O IV é
 * público e deve ser persistido junto do ciphertext (coluna {@code iv}).</p>
 *
 * <p>A chave (256 bits) vem da env var {@code PROJUDI_CRED_KEY} em Base64 de
 * 32 bytes, exposta como {@code projudi.cred.key}. O plaintext (senha) NUNCA é
 * logado nem aparece em mensagens de erro.</p>
 */
@Service
public class CredencialCryptoService {

    private static final Logger log = LoggerFactory.getLogger(CredencialCryptoService.class);

    private static final String TRANSFORMACAO = "AES/GCM/NoPadding";
    private static final String ALGORITMO_CHAVE = "AES";
    private static final int TAG_BITS = 128;
    private static final int IV_BYTES = 12;
    private static final int CHAVE_BYTES = 32;

    private final SecureRandom secureRandom = new SecureRandom();

    /** Base64 de 32 bytes; vazio quando a env var não foi definida. */
    private final String chaveBase64;

    private SecretKey chave;

    public CredencialCryptoService(@Value("${projudi.cred.key:}") String chaveBase64) {
        this.chaveBase64 = chaveBase64;
    }

    @PostConstruct
    void inicializar() {
        if (chaveBase64 == null || chaveBase64.isBlank()) {
            // Ausência de chave é tolerada na partida; a validação "há credencial => exige chave"
            // é feita por quem cifra/decifra (ver ProjudiCredencialService).
            log.info("PROJUDI_CRED_KEY não definida; cofre de credenciais inativo até configuração.");
            return;
        }
        this.chave = carregarChave(chaveBase64);
    }

    /** Indica se a chave de cifragem está configurada e válida. */
    public boolean chaveConfigurada() {
        return chave != null;
    }

    /**
     * Cifra o plaintext com um IV novo e aleatório.
     *
     * @return par (ciphertext+tag, iv) — ambos para persistir.
     */
    public Resultado cifrar(String textoEmClaro) {
        if (textoEmClaro == null) {
            throw new IllegalArgumentException("Texto a cifrar não pode ser nulo.");
        }
        SecretKey k = exigirChave();
        try {
            byte[] iv = new byte[IV_BYTES];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMACAO);
            cipher.init(Cipher.ENCRYPT_MODE, k, new GCMParameterSpec(TAG_BITS, iv));
            byte[] cifrado = cipher.doFinal(textoEmClaro.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return new Resultado(cifrado, iv);
        } catch (Exception e) {
            // Mensagem deliberadamente genérica: não expor plaintext nem detalhes de chave.
            throw new IllegalStateException("Falha ao cifrar credencial.", sanitizar(e));
        }
    }

    /**
     * Decifra o ciphertext autenticado usando o IV correspondente.
     *
     * @return o plaintext (uso interno; jamais devolver em DTO/log).
     */
    public String decifrar(byte[] cifrado, byte[] iv) {
        if (cifrado == null || iv == null) {
            throw new IllegalArgumentException("Ciphertext e IV são obrigatórios.");
        }
        SecretKey k = exigirChave();
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMACAO);
            cipher.init(Cipher.DECRYPT_MODE, k, new GCMParameterSpec(TAG_BITS, iv));
            byte[] claro = cipher.doFinal(cifrado);
            return new String(claro, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao decifrar credencial.", sanitizar(e));
        }
    }

    private SecretKey exigirChave() {
        if (chave == null) {
            throw new IllegalStateException(
                    "PROJUDI_CRED_KEY não configurada: cofre de credenciais indisponível.");
        }
        return chave;
    }

    private static SecretKey carregarChave(String base64) {
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(base64.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("PROJUDI_CRED_KEY inválida: não é Base64 válido.");
        }
        if (bytes.length != CHAVE_BYTES) {
            throw new IllegalStateException(
                    "PROJUDI_CRED_KEY inválida: esperados " + CHAVE_BYTES
                            + " bytes (256 bits), obtidos " + bytes.length + ".");
        }
        return new SecretKeySpec(bytes, ALGORITMO_CHAVE);
    }

    /**
     * Remove qualquer payload (que poderia conter resíduo de plaintext) da causa,
     * preservando apenas o tipo da exceção original para diagnóstico.
     */
    private static Throwable sanitizar(Exception e) {
        return new RuntimeException(e.getClass().getSimpleName());
    }

    /** Resultado da cifragem: ciphertext autenticado + IV usado. */
    public record Resultado(byte[] cifrado, byte[] iv) {
    }
}
