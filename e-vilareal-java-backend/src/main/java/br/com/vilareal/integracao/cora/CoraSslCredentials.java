package br.com.vilareal.integracao.cora;

/**
 * Caminhos de certificado/chave para mTLS (PEM ou PKCS#12).
 * Implementado por {@link CoraProperties} e pelo sandbox.
 */
public interface CoraSslCredentials {

    String getCertPath();

    String getKeyPath();

    String getKeystorePath();

    String getKeystorePassword();
}
