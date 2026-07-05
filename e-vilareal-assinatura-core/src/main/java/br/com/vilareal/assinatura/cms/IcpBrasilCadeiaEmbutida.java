package br.com.vilareal.assinatura.cms;

import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;

import java.io.IOException;
import java.io.InputStream;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.List;

/**
 * Cadeia ICP-Brasil embutida no .p7s (AC Certifica Anápolis v5, AC Soluti v5, Raiz v5).
 * O token fornece apenas o certificado do signatário; estas ACs vêm de resources.
 */
public final class IcpBrasilCadeiaEmbutida {

    private static final String[] DER_RESOURCES = {
        "cadeia-icp/ac-certifica-anapolis-v5.der",
        "cadeia-icp/ac-soluti-v5.der",
        "cadeia-icp/raiz-icp-brasil-v5.der",
    };

    private IcpBrasilCadeiaEmbutida() {}

    public static List<X509Certificate> carregarCadeiaAc() {
        List<X509Certificate> chain = new ArrayList<>(DER_RESOURCES.length);
        JcaX509CertificateConverter converter = new JcaX509CertificateConverter();
        for (String resource : DER_RESOURCES) {
            try (InputStream in = IcpBrasilCadeiaEmbutida.class.getClassLoader().getResourceAsStream(resource)) {
                if (in == null) {
                    throw new IllegalStateException("Resource ausente: " + resource);
                }
                byte[] der = in.readAllBytes();
                X509CertificateHolder holder = new X509CertificateHolder(der);
                chain.add(converter.getCertificate(holder));
            } catch (IOException | CertificateException e) {
                throw new IllegalStateException("Falha ao carregar cadeia ICP: " + resource, e);
            }
        }
        return List.copyOf(chain);
    }

    /** Signatário (token) + 3 ACs até a raiz = 4 certificados no SignedData. */
    public static List<X509Certificate> montarCadeiaCompleta(X509Certificate signerCertificate) {
        List<X509Certificate> full = new ArrayList<>(1 + DER_RESOURCES.length);
        full.add(signerCertificate);
        full.addAll(carregarCadeiaAc());
        return List.copyOf(full);
    }
}
