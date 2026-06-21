package br.com.vilareal.financeiro.application.cora;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/** Normalização de descrição para pareamento PLANILHA ↔ OFX (mesma regra do diagnóstico). */
public final class CoraDuplicataDescricaoMatcher {

    private static final Pattern SUFIXO_DOC = Pattern.compile("\\s*-\\s*[\\d./-]+\\s*$");

    private CoraDuplicataDescricaoMatcher() {}

    public static String normalizarParaPar(String descricao) {
        if (descricao == null || descricao.isBlank()) {
            return "";
        }
        String s = Normalizer.normalize(descricao, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .trim();
        s = removerPrefixo(s, "pagamento recebido");
        s = removerPrefixo(s, "transf pix recebida");
        s = removerPrefixo(s, "transf pix enviada");
        s = removerPrefixo(s, "boleto pago");
        s = removerPrefixo(s, "pgto qr code pix");
        s = SUFIXO_DOC.matcher(s).replaceAll("");
        s = s.replaceAll("[^\\w\\s]", " ");
        return s.replaceAll("\\s+", " ").trim();
    }

    public static boolean descricoesCompativeis(String descricaoPl, String descricaoOx) {
        return normalizarParaPar(descricaoPl).equals(normalizarParaPar(descricaoOx));
    }

    private static String removerPrefixo(String s, String prefixo) {
        String p = prefixo + " - ";
        if (s.startsWith(p)) {
            return s.substring(p.length()).trim();
        }
        return s;
    }
}
