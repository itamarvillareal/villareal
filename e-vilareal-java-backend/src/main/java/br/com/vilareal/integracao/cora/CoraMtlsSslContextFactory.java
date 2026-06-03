package br.com.vilareal.integracao.cora;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.StringUtils;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;

/**
 * Monta {@link SSLContext} com certificado cliente + private key para mTLS Cora.
 */
public final class CoraMtlsSslContextFactory {

    private static final Logger log = LoggerFactory.getLogger(CoraMtlsSslContextFactory.class);

    private CoraMtlsSslContextFactory() {}

    public static SSLContext build(CoraSslCredentials credentials) {
        try {
            KeyStore keyStore = loadKeyStore(credentials);
            KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
            char[] password = credentials.getKeystorePassword() != null
                    ? credentials.getKeystorePassword().toCharArray()
                    : new char[0];
            kmf.init(keyStore, password);

            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(kmf.getKeyManagers(), null, null);
            log.info("[Cora] SSLContext mTLS configurado com sucesso.");
            return sslContext;
        } catch (Exception e) {
            log.error("[Cora] FALHA ao configurar mTLS: {}", e.getMessage());
            throw new IllegalStateException("Não foi possível configurar mTLS Cora: " + e.getMessage(), e);
        }
    }

    private static KeyStore loadKeyStore(CoraSslCredentials credentials) throws Exception {
        if (StringUtils.hasText(credentials.getKeystorePath())) {
            Path p = Path.of(credentials.getKeystorePath());
            if (!Files.isRegularFile(p)) {
                throw new IllegalArgumentException("Keystore Cora não encontrado: " + p);
            }
            char[] pass = StringUtils.hasText(credentials.getKeystorePassword())
                    ? credentials.getKeystorePassword().toCharArray()
                    : new char[0];
            KeyStore ks = KeyStore.getInstance("PKCS12");
            try (InputStream in = Files.newInputStream(p)) {
                ks.load(in, pass);
            }
            log.info("[Cora] KeyStore PKCS12 carregado de {}", p.toAbsolutePath());
            return ks;
        }

        if (!StringUtils.hasText(credentials.getCertPath()) || !StringUtils.hasText(credentials.getKeyPath())) {
            throw new IllegalArgumentException(
                    "Informe certPath + keyPath ou keystorePath (PKCS#12) para mTLS Cora.");
        }

        Path certPath = Path.of(credentials.getCertPath());
        Path keyPath = Path.of(credentials.getKeyPath());
        if (!Files.isRegularFile(certPath)) {
            throw new IllegalArgumentException("Certificado Cora não encontrado: " + certPath);
        }
        if (!Files.isRegularFile(keyPath)) {
            throw new IllegalArgumentException("Chave privada Cora não encontrada: " + keyPath);
        }

        Certificate cert;
        try (InputStream in = Files.newInputStream(certPath)) {
            cert = CertificateFactory.getInstance("X.509").generateCertificate(in);
        }
        PrivateKey privateKey = loadPrivateKeyPem(keyPath);

        KeyStore ks = KeyStore.getInstance("PKCS12");
        ks.load(null, null);
        ks.setKeyEntry("cora-client", privateKey, new char[0], new Certificate[] {cert});
        log.info(
                "[Cora] Certificado PEM {} + chave {} montados em KeyStore em memória.",
                certPath.toAbsolutePath(),
                keyPath.toAbsolutePath());
        return ks;
    }

    private static PrivateKey loadPrivateKeyPem(Path keyPath) throws Exception {
        String pem = Files.readString(keyPath);
        if (pem.contains("BEGIN RSA PRIVATE KEY")) {
            throw new IllegalArgumentException(
                    """
                    Chave PKCS#1 (BEGIN RSA PRIVATE KEY) detectada. Converta para PKCS#8:
                    openssl pkcs8 -topk8 -nocrypt -in sua-chave.key -out sua-chave-pkcs8.pem
                    Ou gere PKCS#12 e configure keystorePath.
                    """);
        }
        if (!pem.contains("BEGIN PRIVATE KEY")) {
            throw new IllegalArgumentException(
                    "Formato de chave não reconhecido em " + keyPath + " (esperado BEGIN PRIVATE KEY).");
        }
        String base64 = pem.replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        byte[] decoded = Base64.getDecoder().decode(base64);
        PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(decoded);
        return KeyFactory.getInstance("RSA").generatePrivate(spec);
    }
}
