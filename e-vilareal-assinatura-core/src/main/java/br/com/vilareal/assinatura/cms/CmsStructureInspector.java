package br.com.vilareal.assinatura.cms;

import org.bouncycastle.asn1.ASN1ObjectIdentifier;
import org.bouncycastle.asn1.cms.Attribute;
import org.bouncycastle.asn1.x509.AlgorithmIdentifier;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cms.CMSException;
import org.bouncycastle.cms.CMSProcessable;
import org.bouncycastle.cms.CMSSignedData;
import org.bouncycastle.cms.SignerInformation;
import org.bouncycastle.cms.jcajce.JcaSimpleSignerInfoVerifierBuilder;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.util.Selector;
import org.bouncycastle.util.Store;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.Security;
import java.security.interfaces.RSAPublicKey;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Inspeção estrutural de .p7s compatível com o programa do tribunal.
 * Não imprime subject/CN/CPF — valida cadeia por issuer SHA-256 e contagem.
 */
public final class CmsStructureInspector {

    static {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    private CmsStructureInspector() {}

    public static CmsStructureReport inspecionar(byte[] p7s) {
        if (p7s == null || p7s.length == 0) {
            return CmsStructureReport.invalido("bytes vazios");
        }

        CMSSignedData signedData;
        try {
            signedData = new CMSSignedData(p7s);
        } catch (CMSException e) {
            return CmsStructureReport.invalido("não é CMS/PKCS#7 válido");
        }

        CMSProcessable signedContent = signedData.getSignedContent();
        boolean attached = signedContent != null;
        byte[] embeddedPdf = null;
        if (attached) {
            try {
                embeddedPdf = extrairBytes(signedContent);
            } catch (Exception e) {
                return CmsStructureReport.invalido("falha ao extrair eContent");
            }
        }

        String eContentTypeOid = signedData.getSignedContentTypeOID();

        @SuppressWarnings("unchecked")
        var signers = signedData.getSignerInfos().getSigners();
        if (signers.size() != 1) {
            return CmsStructureReport.invalido("esperado exatamente 1 SignerInfo, encontrado " + signers.size());
        }
        SignerInformation signer = signers.iterator().next();

        String digestOid = oidOrNull(signer.getDigestAlgorithmID());
        String signatureOid = signer.getEncryptionAlgOID();

        List<String> signedAttrOids = new ArrayList<>();
        List<String> forbiddenPresent = new ArrayList<>();
        List<String> icpPolicyPresent = new ArrayList<>();

        if (signer.getSignedAttributes() != null) {
            @SuppressWarnings("rawtypes")
            var attrs = signer.getSignedAttributes().toASN1Structure().getAttributes();
            for (int i = 0; i < attrs.length; i++) {
                Attribute attr = attrs[i];
                String oid = attr.getAttrType().getId();
                signedAttrOids.add(oid);
                if (CmsOids.SIGNED_ATTRS_PROIBIDOS.contains(oid)) {
                    forbiddenPresent.add(oid);
                }
                if (oid.startsWith("2.16.76.")) {
                    icpPolicyPresent.add(oid);
                }
            }
        }
        signedAttrOids.sort(Comparator.naturalOrder());

        @SuppressWarnings("unchecked")
        Store<X509CertificateHolder> certStore = signedData.getCertificates();
        List<X509CertificateHolder> allCerts = new ArrayList<>(certStore.getMatches(new TodosCertificadosSelector()));
        allCerts.sort(Comparator.comparing(c -> c.getSubject().toString()));

        List<String> issuerSha256 = allCerts.stream()
                .map(c -> sha256Hex(c.getIssuer().toString().getBytes()))
                .sorted()
                .toList();

        int keyBits = 0;
        boolean sigValid = false;
        try {
            X509CertificateHolder signerCert = resolverCertificadoSignatario(signer, allCerts);
            var x509 = new JcaX509CertificateConverter()
                    .setProvider(BouncyCastleProvider.PROVIDER_NAME)
                    .getCertificate(signerCert);
            PublicKey pub = x509.getPublicKey();
            if (pub instanceof RSAPublicKey rsa) {
                keyBits = rsa.getModulus().bitLength();
            }
            sigValid = signer.verify(new JcaSimpleSignerInfoVerifierBuilder()
                    .setProvider(BouncyCastleProvider.PROVIDER_NAME)
                    .build(signerCert));
        } catch (Exception ignored) {
            // assinaturaCriptograficamenteValida permanece false
        }

        return new CmsStructureReport(
                true,
                attached,
                eContentTypeOid,
                digestOid,
                signatureOid,
                List.copyOf(signedAttrOids),
                List.copyOf(forbiddenPresent),
                List.copyOf(icpPolicyPresent),
                allCerts.size(),
                issuerSha256,
                keyBits,
                embeddedPdf,
                sigValid,
                null);
    }

    /**
     * Compara campos estruturais (ignora signingTime, valor RSA e thumbprint do signatário).
     * {@code esperado} é tipicamente o .p7s de referência do tribunal.
     */
    public static List<String> compararEstrutura(CmsStructureReport esperado, CmsStructureReport obtido) {
        List<String> difs = new ArrayList<>();
        if (!esperado.cmsValido()) {
            difs.add("referência inválida: " + esperado.motivoFalha());
            return difs;
        }
        if (!obtido.cmsValido()) {
            difs.add("obtido inválido: " + obtido.motivoFalha());
            return difs;
        }

        comparar(difs, "attached", esperado.attached(), obtido.attached());
        comparar(difs, "eContentTypeOid", esperado.eContentTypeOid(), obtido.eContentTypeOid());
        comparar(difs, "digestAlgorithmOid", esperado.digestAlgorithmOid(), obtido.digestAlgorithmOid());
        comparar(difs, "signatureAlgorithmOid", esperado.signatureAlgorithmOid(), obtido.signatureAlgorithmOid());
        comparar(difs, "signedAttributeOids", esperado.signedAttributeOids(), obtido.signedAttributeOids());
        comparar(difs, "forbiddenAttributeOids (deve vazio)", esperado.forbiddenAttributeOidsPresentes(), obtido.forbiddenAttributeOidsPresentes());
        comparar(difs, "icpBrasilPolicyOids (deve vazio)", esperado.icpBrasilPolicyOidsPresentes(), obtido.icpBrasilPolicyOidsPresentes());
        comparar(difs, "certificateCount", esperado.certificateCount(), obtido.certificateCount());
        comparar(difs, "certificateIssuerSha256", esperado.certificateIssuerSha256(), obtido.certificateIssuerSha256());
        comparar(difs, "signerPublicKeyBits", esperado.signerPublicKeyBits(), obtido.signerPublicKeyBits());

        if (!obtido.assinaturaCriptograficamenteValida()) {
            difs.add("assinaturaCriptograficamenteValida: esperado true, obtido false");
        }
        return List.copyOf(difs);
    }

    /**
     * Gabarito de geração no Mac (autoassinado/PKCS#12): mesma spec CMS, sem exigir identidade da cadeia ICP.
     * A contagem de 4 certs embutidos (signatário + 3 ACs) é validada; issuers do signatário não são comparados à referência.
     */
    public static List<String> validarGabaritoGeracao(CmsStructureReport report) {
        List<String> erros = new ArrayList<>(validarContraSpecTribunal(report));
        return erros;
    }

    /** Campos invariantes entre referência do tribunal e .p7s gerado (exceto cadeia do signatário e hora/RSA). */
    public static List<String> compararGabaritoGeracaoComReferencia(
            CmsStructureReport referencia, CmsStructureReport gerado) {
        List<String> difs = compararEstrutura(referencia, gerado);
        return difs.stream()
                .filter(d -> !d.startsWith("certificateIssuerSha256"))
                .filter(d -> !d.startsWith("assinaturaCriptograficamenteValida"))
                .toList();
    }

    /** Comparação definitiva com .p7s do tribunal (mesmo token): inclui cadeia/issuers; ignora apenas hora/RSA implícitos. */
    public static List<String> compararComReferenciaTribunal(
            CmsStructureReport referencia, CmsStructureReport gerado) {
        return compararEstrutura(referencia, gerado);
    }

    public static List<String> validarContraSpecTribunal(CmsStructureReport report) {
        List<String> erros = new ArrayList<>();
        if (!report.cmsValido()) {
            erros.add(report.motivoFalha());
            return erros;
        }
        if (!report.attached()) {
            erros.add("modo detached — esperado attached");
        }
        if (!CmsOids.ID_DATA.equals(report.eContentTypeOid())) {
            erros.add("eContentType deve ser id-data, obtido " + report.eContentTypeOid());
        }
        if (!CmsOids.SHA512.equals(report.digestAlgorithmOid())) {
            erros.add("digestAlgorithm deve ser SHA-512, obtido " + report.digestAlgorithmOid());
        }
        if (!CmsOids.RSA_ENCRYPTION.equals(report.signatureAlgorithmOid())) {
            erros.add("signatureAlgorithm deve ser rsaEncryption, obtido " + report.signatureAlgorithmOid());
        }
        Set<String> attrs = Set.copyOf(report.signedAttributeOids());
        if (!attrs.equals(CmsOids.SIGNED_ATTRS_ESPERADOS)) {
            erros.add("signedAttributes devem ser exatamente contentType+signingTime+messageDigest, obtido " + attrs);
        }
        if (!report.forbiddenAttributeOidsPresentes().isEmpty()) {
            erros.add("atributos proibidos presentes: " + report.forbiddenAttributeOidsPresentes());
        }
        if (!report.icpBrasilPolicyOidsPresentes().isEmpty()) {
            erros.add("política ICP-Brasil presente: " + report.icpBrasilPolicyOidsPresentes());
        }
        if (report.certificateCount() != 4) {
            erros.add("cadeia deve ter 4 certificados, obtido " + report.certificateCount());
        }
        if (report.signerPublicKeyBits() != 2048) {
            erros.add("chave RSA deve ser 2048 bits, obtido " + report.signerPublicKeyBits());
        }
        if (!report.assinaturaCriptograficamenteValida()) {
            erros.add("assinatura criptográfica inválida");
        }
        return List.copyOf(erros);
    }

    private static void comparar(List<String> difs, String campo, Object esperado, Object obtido) {
        if (!Objects.equals(esperado, obtido)) {
            difs.add(campo + ": esperado " + resumo(esperado) + ", obtido " + resumo(obtido));
        }
    }

    private static String resumo(Object value) {
        if (value instanceof List<?> list) {
            return list.toString();
        }
        return String.valueOf(value);
    }

    private static String oidOrNull(AlgorithmIdentifier id) {
        if (id == null) {
            return null;
        }
        ASN1ObjectIdentifier oid = id.getAlgorithm();
        return oid != null ? oid.getId() : null;
    }

    private static byte[] extrairBytes(CMSProcessable content) throws IOException, CMSException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        content.write(out);
        return out.toByteArray();
    }

    private static X509CertificateHolder resolverCertificadoSignatario(
            SignerInformation signer, List<X509CertificateHolder> allCerts) throws CMSException {
        @SuppressWarnings("unchecked")
        var matches = allCerts.stream()
                .filter(c -> signer.getSID().match(c))
                .collect(Collectors.toList());
        if (!matches.isEmpty()) {
            return matches.getFirst();
        }
        if (allCerts.isEmpty()) {
            throw new CMSException("sem certificados embutidos");
        }
        return allCerts.getFirst();
    }

    private static String sha256Hex(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static final class TodosCertificadosSelector implements Selector<X509CertificateHolder> {
        @Override
        public boolean match(X509CertificateHolder holder) {
            return holder != null;
        }

        @Override
        public Object clone() {
            return this;
        }
    }
}
