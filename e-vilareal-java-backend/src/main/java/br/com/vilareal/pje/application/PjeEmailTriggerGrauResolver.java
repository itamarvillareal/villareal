package br.com.vilareal.pje.application;

import br.com.vilareal.pje.domain.PjeGrau;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class PjeEmailTriggerGrauResolver {

    private static final Pattern ORGAO_JULGADOR =
            Pattern.compile("\"orgaoJulgador\"\\s*:\\s*\"([^\"]*)\"");

    private PjeEmailTriggerGrauResolver() {}

    static PjeGrau resolver(String jsonReferencia, PjeGrau padrao) {
        if (padrao == null) {
            padrao = PjeGrau.PRIMEIRO_GRAU;
        }
        if (jsonReferencia == null || jsonReferencia.isBlank()) {
            return padrao;
        }
        String orgao = extrairOrgaoJulgador(jsonReferencia);
        if (orgao.isBlank()) {
            return inferirDoTexto(jsonReferencia, padrao);
        }
        return inferirDoOrgao(orgao, padrao);
    }

    private static String extrairOrgaoJulgador(String jsonReferencia) {
        Matcher m = ORGAO_JULGADOR.matcher(jsonReferencia);
        return m.find() ? m.group(1) : "";
    }

    private static PjeGrau inferirDoTexto(String texto, PjeGrau padrao) {
        return inferirDoOrgao(texto, padrao);
    }

    private static PjeGrau inferirDoOrgao(String orgao, PjeGrau padrao) {
        String t = orgao.toLowerCase(Locale.ROOT);
        if (t.contains("vara do trabalho")) {
            return PjeGrau.PRIMEIRO_GRAU;
        }
        if (t.contains("turma")
                || t.contains("pleno")
                || t.contains("seção")
                || t.contains("secao")
                || t.contains("gabinete")) {
            return PjeGrau.SEGUNDO_GRAU;
        }
        return padrao;
    }
}
