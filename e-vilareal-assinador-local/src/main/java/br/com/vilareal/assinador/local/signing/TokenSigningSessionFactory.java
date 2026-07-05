package br.com.vilareal.assinador.local.signing;

import br.com.vilareal.assinatura.keystore.Pkcs11TokenException;

public interface TokenSigningSessionFactory {

    TokenSigningSession abrirSessao() throws Pkcs11TokenException, Exception;
}
