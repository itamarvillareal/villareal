package br.com.vilareal.assinador.local.signing;

import br.com.vilareal.assinatura.keystore.Pkcs11TokenException;

/** Sessão PKCS#11/PKCS#12 por lote: open → N assinaturas → close. */
public interface TokenSigningSession extends AutoCloseable {

    byte[] assinarPdf(byte[] pdfBytes) throws Exception;

    @Override
    void close();
}
