package br.com.vilareal.assinatura.cms;

import br.com.vilareal.assinatura.keystore.AssinaturaKeyMaterial;
import org.bouncycastle.cert.jcajce.JcaCertStore;
import org.bouncycastle.cms.CMSProcessableByteArray;
import org.bouncycastle.cms.CMSSignedData;
import org.bouncycastle.cms.CMSSignedDataGenerator;
import org.bouncycastle.cms.CMSTypedData;
import org.bouncycastle.cms.jcajce.JcaSignerInfoGeneratorBuilder;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.asn1.DERNull;
import org.bouncycastle.asn1.nist.NISTObjectIdentifiers;
import org.bouncycastle.asn1.x509.AlgorithmIdentifier;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.bouncycastle.operator.jcajce.JcaDigestCalculatorProviderBuilder;

import java.security.Security;
import java.security.cert.X509Certificate;
import java.util.List;

/**
 * Gera .p7s CMS attached (PDF embutido byte-idêntico) no formato do programa do tribunal.
 */
public final class CmsAttachedPdfSigner {

    static {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    private CmsAttachedPdfSigner() {}

    public static byte[] assinar(byte[] pdfBytes, AssinaturaKeyMaterial material) {
        if (pdfBytes == null || pdfBytes.length == 0) {
            throw new IllegalArgumentException("PDF vazio");
        }
        if (material == null || material.privateKey() == null || material.signerCertificate() == null) {
            throw new IllegalArgumentException("material de assinatura incompleto");
        }

        try {
            List<X509Certificate> chain =
                    IcpBrasilCadeiaEmbutida.montarCadeiaCompleta(material.signerCertificate());

            ContentSigner baseSigner = new JcaContentSignerBuilder("SHA512withRSA")
                    .setProvider(material.signingProvider())
                    .build(material.privateKey());
            ContentSigner contentSigner = CmsTribunalEncoding.rsaEncryptionSigner(baseSigner);

            JcaSignerInfoGeneratorBuilder signerInfoBuilder = new JcaSignerInfoGeneratorBuilder(
                            new JcaDigestCalculatorProviderBuilder()
                                    .setProvider(BouncyCastleProvider.PROVIDER_NAME)
                                    .build())
                    .setDirectSignature(false)
                    .setContentDigest(new AlgorithmIdentifier(NISTObjectIdentifiers.id_sha512, DERNull.INSTANCE))
                    .setSignedAttributeGenerator(CmsTribunalEncoding.atributosAssinadosTribunal());

            CMSSignedDataGenerator generator = new CMSSignedDataGenerator();
            generator.addSignerInfoGenerator(
                    signerInfoBuilder.build(contentSigner, material.signerCertificate()));
            generator.addCertificates(new JcaCertStore(chain));

            CMSTypedData content = new CMSProcessableByteArray(pdfBytes);
            CMSSignedData signedData = generator.generate(content, true);
            return signedData.getEncoded();
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao gerar .p7s CMS", e);
        }
    }
}
