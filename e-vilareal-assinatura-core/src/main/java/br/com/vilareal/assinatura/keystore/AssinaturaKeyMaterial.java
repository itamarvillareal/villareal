package br.com.vilareal.assinatura.keystore;

import java.security.PrivateKey;
import java.security.Provider;
import java.security.cert.X509Certificate;

/**
 * Material criptográfico para uma assinatura CMS (chave + certificado do signatário).
 * A cadeia intermediária/raiz é montada separadamente via {@link IcpBrasilCadeiaEmbutida}.
 */
public record AssinaturaKeyMaterial(
        PrivateKey privateKey,
        X509Certificate signerCertificate,
        Provider signingProvider) {

    public AssinaturaKeyMaterial {
        if (signingProvider == null) {
            throw new IllegalArgumentException("signingProvider é obrigatório");
        }
    }
}
