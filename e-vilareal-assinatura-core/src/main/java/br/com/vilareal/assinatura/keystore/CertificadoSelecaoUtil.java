package br.com.vilareal.assinatura.keystore;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.Provider;
import java.security.cert.X509Certificate;
import java.util.HexFormat;
import java.util.Locale;

/**
 * Seleciona certificado por thumbprint SHA-1 (evita ambiguidade quando há entradas parecidas).
 */
public final class CertificadoSelecaoUtil {

    private CertificadoSelecaoUtil() {}

    public static String thumbprintSha1(X509Certificate certificate) throws Exception {
        byte[] der = certificate.getEncoded();
        MessageDigest md = MessageDigest.getInstance("SHA-1");
        return HexFormat.of().formatHex(md.digest(der)).toUpperCase(Locale.ROOT);
    }

    /**
     * @param thumbprintSha1 hex maiúsculo, sem separadores (ex.: {@code A1B2...})
     * @return alias da entrada cuja chave+cert casam o thumbprint
     */
    public static String resolverAliasPorThumbprintSha1(KeyStore keyStore, String thumbprintSha1)
            throws Exception {
        if (thumbprintSha1 == null || thumbprintSha1.isBlank()) {
            return resolverUnicoAliasChave(keyStore);
        }
        String alvo = thumbprintSha1.trim().toUpperCase(Locale.ROOT);
        String encontrado = null;
        var aliases = keyStore.aliases();
        while (aliases.hasMoreElements()) {
            String alias = aliases.nextElement();
            if (!keyStore.isKeyEntry(alias)) {
                continue;
            }
            X509Certificate cert = (X509Certificate) keyStore.getCertificate(alias);
            if (cert == null) {
                continue;
            }
            if (!alvo.equals(thumbprintSha1(cert))) {
                continue;
            }
            if (encontrado != null) {
                throw new IllegalStateException(
                        "mais de um alias com thumbprint SHA-1 " + alvo + " no keystore");
            }
            encontrado = alias;
        }
        if (encontrado == null) {
            throw new IllegalStateException(
                    "nenhum certificado no keystore com thumbprint SHA-1 " + alvo);
        }
        return encontrado;
    }

    public static String resolverUnicoAliasChave(KeyStore keyStore) throws Exception {
        String encontrado = null;
        var aliases = keyStore.aliases();
        while (aliases.hasMoreElements()) {
            String alias = aliases.nextElement();
            if (!keyStore.isKeyEntry(alias)) {
                continue;
            }
            if (encontrado != null) {
                throw new IllegalStateException(
                        "mais de uma chave no keystore — informe thumbprint SHA-1 do signatário");
            }
            encontrado = alias;
        }
        if (encontrado == null) {
            throw new IllegalStateException("nenhuma chave privada encontrada no keystore");
        }
        return encontrado;
    }

    public static AssinaturaKeyMaterial carregarMaterial(
            KeyStore keyStore, String alias, char[] keyPassword, Provider signingProvider)
            throws Exception {
        PrivateKey privateKey = (PrivateKey) keyStore.getKey(alias, keyPassword);
        if (privateKey == null) {
            throw new IllegalStateException("alias sem chave privada: " + alias);
        }
        X509Certificate certificate = (X509Certificate) keyStore.getCertificate(alias);
        if (certificate == null) {
            throw new IllegalStateException("alias sem certificado: " + alias);
        }
        return new AssinaturaKeyMaterial(privateKey, certificate, signingProvider);
    }

    public static KeyStore carregarPkcs12(Path path, char[] password) throws Exception {
        KeyStore keyStore = KeyStore.getInstance("PKCS12");
        try (InputStream in = Files.newInputStream(path)) {
            keyStore.load(in, password);
        }
        return keyStore;
    }
}
