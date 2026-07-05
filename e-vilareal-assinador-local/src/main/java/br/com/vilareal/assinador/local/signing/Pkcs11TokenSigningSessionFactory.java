package br.com.vilareal.assinador.local.signing;

import br.com.vilareal.assinatura.cms.CmsAttachedPdfSigner;
import br.com.vilareal.assinatura.keystore.AssinaturaKeyMaterial;
import br.com.vilareal.assinatura.keystore.Pkcs11KeyMaterialProvider;
import br.com.vilareal.assinatura.keystore.Pkcs11TokenException;
import br.com.vilareal.assinador.local.config.AssinadorLocalConfig;

import java.nio.file.Path;

public final class Pkcs11TokenSigningSessionFactory implements TokenSigningSessionFactory {

    private final AssinadorLocalConfig config;

    public Pkcs11TokenSigningSessionFactory(AssinadorLocalConfig config) {
        this.config = config;
    }

    @Override
    public TokenSigningSession abrirSessao() throws Pkcs11TokenException, Exception {
        Path cfg = Pkcs11KeyMaterialProvider.resolverCfgPath();
        char[] pin = config.tokenPinClone();
        Pkcs11KeyMaterialProvider provider = new Pkcs11KeyMaterialProvider(cfg, pin);
        try {
            provider.open();
            AssinaturaKeyMaterial material = provider.load();
            return new Pkcs11TokenSigningSession(provider, material);
        } catch (Pkcs11TokenException e) {
            provider.close();
            throw e;
        } catch (Exception e) {
            provider.close();
            throw e;
        }
    }

    private static final class Pkcs11TokenSigningSession implements TokenSigningSession {

        private final Pkcs11KeyMaterialProvider provider;
        private final AssinaturaKeyMaterial material;

        private Pkcs11TokenSigningSession(Pkcs11KeyMaterialProvider provider, AssinaturaKeyMaterial material) {
            this.provider = provider;
            this.material = material;
        }

        @Override
        public byte[] assinarPdf(byte[] pdfBytes) {
            return CmsAttachedPdfSigner.assinar(pdfBytes, material);
        }

        @Override
        public void close() {
            provider.close();
        }
    }
}
