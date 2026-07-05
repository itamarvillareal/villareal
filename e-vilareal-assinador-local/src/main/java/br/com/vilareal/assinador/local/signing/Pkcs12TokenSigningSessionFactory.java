package br.com.vilareal.assinador.local.signing;

import br.com.vilareal.assinatura.cms.CmsAttachedPdfSigner;
import br.com.vilareal.assinatura.keystore.AssinaturaKeyMaterial;
import br.com.vilareal.assinatura.keystore.Pkcs12KeyMaterialProvider;

import java.nio.file.Path;

/** Sessão de teste com PKCS#12 (Mac/CI) — não usa token hardware. */
public final class Pkcs12TokenSigningSessionFactory implements TokenSigningSessionFactory {

    private final Path keystorePath;
    private final char[] password;

    public Pkcs12TokenSigningSessionFactory(Path keystorePath, char[] password) {
        this.keystorePath = keystorePath;
        this.password = password.clone();
    }

    @Override
    public TokenSigningSession abrirSessao() throws Exception {
        Pkcs12KeyMaterialProvider provider = new Pkcs12KeyMaterialProvider(keystorePath, password);
        AssinaturaKeyMaterial material = provider.load();
        return new TokenSigningSession() {
            @Override
            public byte[] assinarPdf(byte[] pdfBytes) {
                return CmsAttachedPdfSigner.assinar(pdfBytes, material);
            }

            @Override
            public void close() {
                provider.close();
            }
        };
    }
}
