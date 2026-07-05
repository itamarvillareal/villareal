package br.com.vilareal.assinatura.cms;

import org.bouncycastle.asn1.ASN1ObjectIdentifier;
import org.bouncycastle.asn1.DERNull;
import org.bouncycastle.asn1.cms.Attribute;
import org.bouncycastle.asn1.cms.AttributeTable;
import org.bouncycastle.asn1.pkcs.PKCSObjectIdentifiers;
import org.bouncycastle.asn1.x509.AlgorithmIdentifier;
import org.bouncycastle.cms.CMSAttributeTableGenerationException;
import org.bouncycastle.cms.CMSAttributeTableGenerator;
import org.bouncycastle.cms.DefaultSignedAttributeTableGenerator;
import org.bouncycastle.operator.ContentSigner;

import java.io.OutputStream;
import java.util.Hashtable;
import java.util.Map;

/**
 * Ajustes para igualar o encoding do programa do tribunal:
 * - signatureAlgorithm = rsaEncryption (não sha512WithRSAEncryption)
 * - signedAttributes = apenas contentType, signingTime, messageDigest
 */
final class CmsTribunalEncoding {

    private static final AlgorithmIdentifier RSA_ENCRYPTION =
            new AlgorithmIdentifier(PKCSObjectIdentifiers.rsaEncryption, DERNull.INSTANCE);

    private CmsTribunalEncoding() {}

    static ContentSigner rsaEncryptionSigner(ContentSigner base) {
        return new ContentSigner() {
            @Override
            public AlgorithmIdentifier getAlgorithmIdentifier() {
                return RSA_ENCRYPTION;
            }

            @Override
            public OutputStream getOutputStream() {
                return base.getOutputStream();
            }

            @Override
            public byte[] getSignature() {
                return base.getSignature();
            }
        };
    }

    static CMSAttributeTableGenerator atributosAssinadosTribunal() {
        return new CMSAttributeTableGenerator() {
            @Override
            public AttributeTable getAttributes(Map parameters) throws CMSAttributeTableGenerationException {
                AttributeTable gerado = new DefaultSignedAttributeTableGenerator().getAttributes(parameters);
                Hashtable<ASN1ObjectIdentifier, Attribute> filtrado = new Hashtable<>();
                for (Attribute attr : gerado.toASN1Structure().getAttributes()) {
                    String oid = attr.getAttrType().getId();
                    if (CmsOids.SIGNED_ATTRS_ESPERADOS.contains(oid)) {
                        filtrado.put(attr.getAttrType(), attr);
                    }
                }
                return new AttributeTable(filtrado);
            }
        };
    }
}
