package br.com.vilareal.assinatura.cms;

import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cms.CMSException;
import org.bouncycastle.cms.CMSSignedData;
import org.bouncycastle.cms.SignerInformation;
import org.bouncycastle.util.Selector;
import org.bouncycastle.util.Store;

import javax.security.auth.x500.X500Principal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * Valida a cadeia ICP embutida no .p7s (ordem signatário → ACs → raiz).
 * Não imprime subject/CN/CPF do signatário — apenas issuers e marcadores de posição.
 */
public final class CmsCadeiaEmbutidaInspector {

    /** Marcadores esperados no issuer de cada elo (posição 0 = certificado do signatário). */
    private static final List<String> ISSUER_MARCADORES_ICP = List.of(
            "CN=AC CERTIFICA ANAPOLIS v5",
            "CN=AC SOLUTI v5",
            "CN=Autoridade Certificadora Raiz Brasileira v5",
            "CN=Autoridade Certificadora Raiz Brasileira v5");

    private CmsCadeiaEmbutidaInspector() {}

    public record CadeiaEmbutidaReport(
            boolean valida,
            int quantidade,
            List<String> issuersOrdenados,
            List<String> erros) {}

    public static CadeiaEmbutidaReport inspecionar(byte[] p7s) {
        try {
            CMSSignedData signedData = new CMSSignedData(p7s);
            @SuppressWarnings("unchecked")
            Store<X509CertificateHolder> certStore = signedData.getCertificates();
            List<X509CertificateHolder> todos = new ArrayList<>();
            for (X509CertificateHolder holder : certStore.getMatches(new TodosCertificadosSelector())) {
                todos.add(holder);
            }
            if (todos.isEmpty()) {
                return invalida("nenhum certificado embutido");
            }

            SignerInformation signer = signedData.getSignerInfos().getSigners().iterator().next();
            X509CertificateHolder signatario = localizarSignatario(signer, todos);
            List<X509CertificateHolder> ordenada = ordenarCadeia(signatario, todos);

            List<String> issuers = ordenada.stream()
                    .map(c -> c.getIssuer().toString())
                    .toList();

            List<String> erros = validarMarcadores(issuers);
            if (ordenada.size() != 4) {
                erros.add("cadeia deve ter 4 certificados, obtido " + ordenada.size());
            }

            X509CertificateHolder raiz = ordenada.get(ordenada.size() - 1);
            if (!raiz.getIssuer().equals(raiz.getSubject())) {
                erros.add("último certificado deve ser raiz autoassinada");
            }

            return new CadeiaEmbutidaReport(erros.isEmpty(), ordenada.size(), issuers, List.copyOf(erros));
        } catch (Exception e) {
            return invalida("falha ao inspecionar cadeia: " + e.getClass().getSimpleName());
        }
    }

    public static List<String> compararIssuersComReferencia(List<String> referencia, List<String> obtido) {
        List<String> difs = new ArrayList<>();
        if (referencia.size() != obtido.size()) {
            difs.add("quantidade de issuers: esperado " + referencia.size() + ", obtido " + obtido.size());
            return difs;
        }
        for (int i = 0; i < referencia.size(); i++) {
            if (!normalizarDn(referencia.get(i)).equals(normalizarDn(obtido.get(i)))) {
                difs.add("issuer[" + i + "] difere da referência do tribunal");
            }
        }
        return List.copyOf(difs);
    }

    public static List<String> extrairIssuersReferencia(byte[] p7sReferencia) {
        CadeiaEmbutidaReport report = inspecionar(p7sReferencia);
        if (!report.valida()) {
            throw new IllegalStateException("referência com cadeia inválida: " + report.erros());
        }
        return report.issuersOrdenados();
    }

    private static CadeiaEmbutidaReport invalida(String motivo) {
        return new CadeiaEmbutidaReport(false, 0, List.of(), List.of(motivo));
    }

    private static List<String> validarMarcadores(List<String> issuers) {
        List<String> erros = new ArrayList<>();
        int limite = Math.min(ISSUER_MARCADORES_ICP.size(), issuers.size());
        for (int i = 0; i < limite; i++) {
            String issuer = issuers.get(i);
            String marcador = ISSUER_MARCADORES_ICP.get(i);
            if (!issuer.contains(marcador)) {
                erros.add("issuer[" + i + "] deve conter \"" + marcador + "\"");
            }
        }
        return erros;
    }

    private static X509CertificateHolder localizarSignatario(
            SignerInformation signer, List<X509CertificateHolder> todos) throws CMSException {
        for (X509CertificateHolder holder : todos) {
            if (signer.getSID().match(holder)) {
                return holder;
            }
        }
        throw new CMSException("certificado do signatário não encontrado no SignedData");
    }

    private static List<X509CertificateHolder> ordenarCadeia(
            X509CertificateHolder signatario, List<X509CertificateHolder> todos) {
        Map<String, X509CertificateHolder> porSubject = new HashMap<>();
        for (X509CertificateHolder holder : todos) {
            porSubject.putIfAbsent(normalizarDn(holder.getSubject().toString()), holder);
        }

        List<X509CertificateHolder> cadeia = new ArrayList<>();
        X509CertificateHolder atual = signatario;
        while (atual != null && cadeia.size() <= todos.size()) {
            cadeia.add(atual);
            String issuerDn = normalizarDn(atual.getIssuer().toString());
            String subjectDn = normalizarDn(atual.getSubject().toString());
            if (issuerDn.equals(subjectDn)) {
                break;
            }
            atual = porSubject.get(issuerDn);
            if (atual != null && cadeia.contains(atual)) {
                break;
            }
        }
        return List.copyOf(cadeia);
    }

    private static String normalizarDn(String dn) {
        return new X500Principal(dn).getName(X500Principal.RFC1779).toUpperCase(Locale.ROOT);
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
