package br.com.vilareal.totp.security;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Cifragem AES/GCM dos segredos TOTP em repouso.
 * Persistência: Base64(IV_12_bytes || ciphertext+tag).
 */
@Service
public class SegredoCipherService {

    private static final Logger log = LoggerFactory.getLogger(SegredoCipherService.class);

    private static final String TRANSFORMACAO = "AES/GCM/NoPadding";
    private static final String ALGORITMO_CHAVE = "AES";
    private static final int TAG_BITS = 128;
    private static final int IV_BYTES = 12;
    private static final int CHAVE_BYTES = 32;

    private final SecureRandom secureRandom = new SecureRandom();
    private final String chaveBase64;
    private SecretKey chave;

    public SegredoCipherService(
            @Value("${app.totp.encryption-key:}") String chaveBase64,
            @Value("${app.totp.encryption-key-file:}") String keyFilePath) {
        this.chaveBase64 = resolverChaveBase64(chaveBase64, keyFilePath);
    }

    static String resolverChaveBase64(String chaveBase64, String keyFilePath) {
        if (StringUtils.hasText(chaveBase64)) {
            return chaveBase64.trim();
        }
        if (!StringUtils.hasText(keyFilePath)) {
            return "";
        }
        Path path = Path.of(keyFilePath.trim());
        if (!path.isAbsolute()) {
            path = Path.of(System.getProperty("user.dir")).resolve(path);
        }
        if (!Files.isRegularFile(path)) {
            return "";
        }
        try {
            return Files.readString(path).trim().replaceAll("\\s+", "");
        } catch (Exception e) {
            throw new IllegalStateException(
                    "Não foi possível ler app.totp.encryption-key-file (" + path + "): " + e.getMessage());
        }
    }

    @PostConstruct
    void inicializar() {
        if (chaveBase64 == null || chaveBase64.isBlank()) {
            log.info("app.totp.encryption-key não definida; cofre TOTP inativo até configuração.");
            return;
        }
        this.chave = carregarChave(chaveBase64);
    }

    public boolean chaveConfigurada() {
        return chave != null;
    }

    public String cifrar(String textoEmClaro) {
        if (textoEmClaro == null) {
            throw new IllegalArgumentException("Texto a cifrar não pode ser nulo.");
        }
        SecretKey k = exigirChave();
        try {
            byte[] iv = new byte[IV_BYTES];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMACAO);
            cipher.init(Cipher.ENCRYPT_MODE, k, new GCMParameterSpec(TAG_BITS, iv));
            byte[] cifrado = cipher.doFinal(textoEmClaro.getBytes(StandardCharsets.UTF_8));
            byte[] pacote = new byte[iv.length + cifrado.length];
            System.arraycopy(iv, 0, pacote, 0, iv.length);
            System.arraycopy(cifrado, 0, pacote, iv.length, cifrado.length);
            return Base64.getEncoder().encodeToString(pacote);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao cifrar segredo TOTP.", e);
        }
    }

    public String decifrar(String secretCriptografadoBase64) {
        if (secretCriptografadoBase64 == null || secretCriptografadoBase64.isBlank()) {
            throw new IllegalArgumentException("Segredo criptografado é obrigatório.");
        }
        SecretKey k = exigirChave();
        try {
            byte[] pacote = Base64.getDecoder().decode(secretCriptografadoBase64.trim());
            if (pacote.length <= IV_BYTES) {
                throw new IllegalArgumentException("Pacote cifrado TOTP inválido.");
            }
            byte[] iv = new byte[IV_BYTES];
            System.arraycopy(pacote, 0, iv, 0, IV_BYTES);
            byte[] cifrado = new byte[pacote.length - IV_BYTES];
            System.arraycopy(pacote, IV_BYTES, cifrado, 0, cifrado.length);
            Cipher cipher = Cipher.getInstance(TRANSFORMACAO);
            cipher.init(Cipher.DECRYPT_MODE, k, new GCMParameterSpec(TAG_BITS, iv));
            byte[] claro = cipher.doFinal(cifrado);
            return new String(claro, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao decifrar segredo TOTP.", e);
        }
    }

    private SecretKey exigirChave() {
        if (chave == null) {
            throw new IllegalStateException(
                    "app.totp.encryption-key não configurada: cofre TOTP indisponível.");
        }
        return chave;
    }

    private static SecretKey carregarChave(String base64) {
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(base64.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("app.totp.encryption-key inválida: não é Base64 válido.");
        }
        if (bytes.length != CHAVE_BYTES) {
            throw new IllegalStateException(
                    "app.totp.encryption-key inválida: esperados " + CHAVE_BYTES
                            + " bytes (256 bits), obtidos " + bytes.length + ".");
        }
        return new SecretKeySpec(bytes, ALGORITMO_CHAVE);
    }
}
