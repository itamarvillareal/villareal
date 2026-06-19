package br.com.vilareal.financeiro.ofx;

import org.springframework.util.StringUtils;

/**
 * Monta descrição principal e detalhada a partir de NAME/MEMO do OFX.
 * Sicoob: MEMO genérico (tipo Pix) e NAME com contraparte; Itaú/Cora: MEMO costuma ter o detalhe.
 */
public final class OfxDescricaoUtil {

    private OfxDescricaoUtil() {}

    public record Descricoes(String descricao, String descricaoDetalhada) {}

    public static Descricoes montar(String name, String memo, String trnType) {
        String n = normalizar(name);
        String m = normalizar(memo);
        String descricao = escolherPrincipal(n, m);
        String detalhe = montarDetalhada(n, m, trnType, descricao);
        return new Descricoes(descricao, detalhe);
    }

    static String escolherPrincipal(String name, String memo) {
        if (!StringUtils.hasText(name) && !StringUtils.hasText(memo)) {
            return "LANÇAMENTO";
        }
        if (!StringUtils.hasText(name)) {
            return memo;
        }
        if (!StringUtils.hasText(memo)) {
            return name;
        }
        if (name.equals(memo)) {
            return name;
        }
        if (nameSicoobComContraparte(name, memo)) {
            return name;
        }
        int nameWords = name.trim().split("\\s+").length;
        int memoWords = memo.trim().split("\\s+").length;
        if (name.length() < memo.length() && memoWords > nameWords) {
            return memo;
        }
        return name.length() >= memo.length() ? name : memo;
    }

    static String montarDetalhada(String name, String memo, String trnType, String descricaoPrincipal) {
        String principal = normalizar(descricaoPrincipal);
        String n = normalizar(name);
        String m = normalizar(memo);
        StringBuilder secundario = new StringBuilder();
        if (StringUtils.hasText(m) && !m.equals(principal)) {
            secundario.append(m);
        }
        if (StringUtils.hasText(n) && !n.equals(principal) && !n.equals(m)) {
            if (secundario.length() > 0) {
                secundario.append(" · ");
            }
            secundario.append(n);
        }
        if (secundario.length() == 0) {
            return trnType != null ? trnType : "";
        }
        String texto = secundario.toString();
        return StringUtils.hasText(trnType) ? trnType + " — " + texto : texto;
    }

    private static boolean nameSicoobComContraparte(String name, String memo) {
        if (!StringUtils.hasText(name) || !StringUtils.hasText(memo)) {
            return false;
        }
        if (name.matches("(?i)^(RECEBIMENTO|PAGAMENTO)\\s+PIX\\b")
                && memo.matches("(?i).*PIX\\s+(RECEBIDO|EMITIDO).*")) {
            return true;
        }
        return name.matches("(?i)^SAQ\\.?\\s*DIG.*") && memo.matches("(?i).*SAQUE.*");
    }

    private static String normalizar(String s) {
        if (s == null) {
            return "";
        }
        return s.replaceAll("\\s+", " ").trim();
    }
}
