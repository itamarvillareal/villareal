package br.com.vilareal.projudi;

import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cms.jcajce.JcaSimpleSignerInfoVerifierBuilder;
import org.bouncycastle.cms.CMSException;
import org.bouncycastle.cms.CMSProcessable;
import org.bouncycastle.cms.CMSSignedData;
import org.bouncycastle.cms.SignerInformation;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.util.Store;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.Security;
import java.util.Collection;
import java.util.HexFormat;

/**
 * Validação estrutural de arquivos .p7s (CMS/PKCS#7) com conteúdo embutido.
 * Não valida cadeia ICP-Brasil — apenas parse CMS e consistência signatário × cert embutido.
 */
public final class ProjudiAssinaturaP7sUtil {

    private static final byte[] PDF_MAGIC = "%PDF".getBytes();

    static {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    private ProjudiAssinaturaP7sUtil() {}

    public record ValidacaoP7s(
            boolean cmsValido,
            boolean temConteudoEmbutido,
            boolean assinaturaConsistente,
            byte[] pdfEmbutido,
            String sha256ConteudoEmbutido,
            String motivo) {}

    public static ValidacaoP7s validar(byte[] p7s) {
        if (p7s == null || p7s.length == 0) {
            return new ValidacaoP7s(false, false, false, null, null, "bytes vazios");
        }

        CMSSignedData signedData;
        try {
            signedData = new CMSSignedData(p7s);
        } catch (CMSException e) {
            return new ValidacaoP7s(false, false, false, null, null, "não é CMS/PKCS#7");
        }

        CMSProcessable signedContent = signedData.getSignedContent();
        if (signedContent == null) {
            return new ValidacaoP7s(
                    true, false, false, null, null, "p7s destacado (sem PDF embutido)");
        }

        byte[] embedido;
        try {
            embedido = extrairBytes(signedContent);
        } catch (Exception e) {
            return new ValidacaoP7s(
                    true, false, false, null, null, "falha ao extrair conteúdo embutido");
        }

        String sha = sha256(embedido);
        String motivo = null;
        if (!iniciaComPdf(embedido)) {
            motivo = "conteúdo embutido não começa com %PDF";
        }

        boolean assinaturaConsistente = verificarAssinaturas(signedData);
        if (!assinaturaConsistente && motivo == null) {
            motivo = "assinatura inconsistente";
        }

        return new ValidacaoP7s(true, true, assinaturaConsistente, embedido, sha, motivo);
    }

    public static String sha256(byte[] bytes) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(bytes));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 indisponível", e);
        }
    }

    private static byte[] extrairBytes(CMSProcessable content) throws IOException, CMSException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        content.write(out);
        return out.toByteArray();
    }

    private static boolean iniciaComPdf(byte[] bytes) {
        if (bytes.length < PDF_MAGIC.length) {
            return false;
        }
        for (int i = 0; i < PDF_MAGIC.length; i++) {
            if (bytes[i] != PDF_MAGIC[i]) {
                return false;
            }
        }
        return true;
    }

    @SuppressWarnings("unchecked")
    private static boolean verificarAssinaturas(CMSSignedData signedData) {
        try {
            Store<X509CertificateHolder> certStore = signedData.getCertificates();
            JcaSimpleSignerInfoVerifierBuilder verifierBuilder =
                    new JcaSimpleSignerInfoVerifierBuilder().setProvider(BouncyCastleProvider.PROVIDER_NAME);

            for (SignerInformation signer : signedData.getSignerInfos().getSigners()) {
                Collection<X509CertificateHolder> matches = certStore.getMatches(signer.getSID());
                for (X509CertificateHolder holder : matches) {
                    if (signer.verify(verifierBuilder.build(holder))) {
                        return true;
                    }
                }
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }
}
