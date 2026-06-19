package br.com.vilareal.financeiro.domain;

import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

/** Comparação de nomes em descrições bancárias vs cadastro de pessoas. */
public final class FinanceiroDescricaoNomeUtil {

    private FinanceiroDescricaoNomeUtil() {}

    public static String normalizarTextoDescricao(String descricao, String descricaoDetalhada) {
        String texto = ((descricao != null ? descricao : "") + " " + (descricaoDetalhada != null ? descricaoDetalhada : ""))
                .trim();
        if (!StringUtils.hasText(texto)) {
            return "";
        }
        String n = Normalizer.normalize(texto.toLowerCase(Locale.ROOT), Normalizer.Form.NFD);
        return n.replaceAll("\\p{M}+", "").replaceAll("[^a-z0-9\\s]", " ").replaceAll("\\s+", " ").trim();
    }

    public static boolean nomesCompativeis(String nomeExtrato, String nomeCadastro) {
        String a = normalizarNomeComparacao(nomeExtrato);
        String b = normalizarNomeComparacao(nomeCadastro);
        if (!StringUtils.hasText(a) || !StringUtils.hasText(b)) {
            return true;
        }
        if (a.contains(b) || b.contains(a)) {
            return true;
        }
        Set<String> ta = tokensNomeSignificativos(a);
        Set<String> tb = tokensNomeSignificativos(b);
        if (ta.isEmpty() || tb.isEmpty()) {
            return false;
        }
        long comuns = ta.stream().filter(tb::contains).count();
        return comuns >= 2 || (comuns >= 1 && (ta.size() == 1 || tb.size() == 1));
    }

    private static String normalizarNomeComparacao(String nome) {
        if (!StringUtils.hasText(nome)) {
            return "";
        }
        String n = Normalizer.normalize(nome.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD);
        return n.replaceAll("\\p{M}+", "").replaceAll("[^a-z0-9\\s]", " ").replaceAll("\\s+", " ").trim();
    }

    private static Set<String> tokensNomeSignificativos(String nomeNorm) {
        Set<String> out = new LinkedHashSet<>();
        for (String t : nomeNorm.split("\\s+")) {
            if (t.length() >= 3 && !Set.of("dos", "das", "de", "da", "do", "e").contains(t)) {
                out.add(t);
            }
        }
        return out;
    }
}
