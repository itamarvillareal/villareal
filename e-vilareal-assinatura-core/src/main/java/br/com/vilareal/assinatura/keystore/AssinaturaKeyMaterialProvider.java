package br.com.vilareal.assinatura.keystore;

import java.security.Provider;

/**
 * Abre sessão com a chave privada (PKCS#11 ou PKCS#12) e devolve o material do signatário.
 */
public interface AssinaturaKeyMaterialProvider extends AutoCloseable {

    AssinaturaKeyMaterial load() throws Exception;

    /** Provider JCA para a operação de assinatura (SunPKCS11 no token A3; BC no PKCS#12). */
    Provider signingProvider();

    @Override
    void close();
}
