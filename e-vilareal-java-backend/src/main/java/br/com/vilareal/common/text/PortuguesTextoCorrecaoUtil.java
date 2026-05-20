package br.com.vilareal.common.text;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Normalização de texto jurídico em português: mojibake UTF-8/Latin-1, caractere de substituição (U+FFFD)
 * e palavras com acentos perdidos na importação.
 */
public final class PortuguesTextoCorrecaoUtil {

    private static final String REPL = "\uFFFD";
    private static final Pattern MULTI_SPACE = Pattern.compile("\\s{2,}");

    private static final String[][] SUBSTITUICOES_REPLACEMENT = {
        {"DECIS" + REPL + "ÕES", "DECISÕES"},
        {"DECIS" + REPL + "OES", "DECISÕES"},
        {"DESCIS" + REPL + "OES", "DECISÕES"},
        {"DECIS" + REPL + REPL + "O", "DECISÃO"},
        {"DECIS" + REPL + "O", "DECISÃO"},
        {"N" + REPL + REPL + "O", "NÃO"},
        {"CONHE" + REPL + "O", "CONHEÇO"},
        {"CONCESS" + REPL + "O", "CONCESSÃO"},
        {"N" + REPL + "O-", "NÃO-"},
        {"N" + REPL + "O ", "NÃO "},
        {"N" + REPL + "O.", "NÃO."},
        {"N" + REPL + "O,", "NÃO,"},
        {"N" + REPL + "O;", "NÃO;"},
        {"INADMISS" + REPL + "VEL", "INADMISSÍVEL"},
        {"INADMISSIVEL", "INADMISSÍVEL"},
        {"JUSTI" + REPL + "A", "JUSTIÇA"},
        {"CAMA" + REPL + "ARA", "CÂMARA"},
        {"C" + REPL + "MARA", "CÂMARA"},
        {"COMPET" + REPL + "NCIA", "COMPETÊNCIA"},
        {"COMPETENCIA", "COMPETÊNCIA"},
        {"EXECU" + REPL + "O", "EXECUÇÃO"},
        {"EXECUCAO", "EXECUÇÃO"},
        {"PENS" + REPL + "O", "PENSÃO"},
        {"PENSAO", "PENSÃO"},
        {"GRATUIDADE", "GRATUIDADE"},
        {"IND" + REPL + "BITO", "INDÉBITO"},
        {"INDEBITO", "INDÉBITO"},
        {"REPETI" + REPL + "O", "REPETIÇÃO"},
        {"REPETICAO", "REPETIÇÃO"},
        {"INDENIZA" + REPL + "O", "INDENIZAÇÃO"},
        {"INDENIZACAO", "INDENIZAÇÃO"},
        {"INQU" + REPL + "RITO", "INQUÉRITO"},
        {"INQUERITO", "INQUÉRITO"},
        {"TR" + REPL + "NSITO", "TRÂNSITO"},
        {"TR" + REPL + "ÂNSITO", "TRÂNSITO"},
        {"GOI" + REPL + "S", "GOIÁS"},
        {"GOI" + REPL + "ÁS", "GOIÁS"},
        {"AN" + REPL + "POLIS", "ANÁPOLIS"},
        {"AN" + REPL + "ÁPOLIS", "ANÁPOLIS"},
        {"AGRAV" + REPL + "O", "AGRAVO"},
        {"PREJUDIC" + REPL + "ADA", "PREJUDICADA"},
        {"PREJUDICADA", "PREJUDICADA"},
        {"SUCUMB" + REPL + "NCIA", "SUCUMBÊNCIA"},
        {"SUCUMBENCIA", "SUCUMBÊNCIA"},
        {"HONOR" + REPL + "RIOS", "HONORÁRIOS"},
        {"HONORARIOS", "HONORÁRIOS"},
        {"INTIMA" + REPL + "O", "INTIMAÇÃO"},
        {"INTIMACAO", "INTIMAÇÃO"},
        {"PUBLICA" + REPL + "O", "PUBLICAÇÃO"},
        {"PUBLICACAO", "PUBLICAÇÃO"},
        {"PETI" + REPL + "O", "PETIÇÃO"},
        {"PETICAO", "PETIÇÃO"},
        {"SENTEN" + REPL + "A", "SENTENÇA"},
        {"SENTENCA", "SENTENÇA"},
        {"RECUR" + REPL + "O", "RECURSO"},
        {"JULGAD" + REPL + "A", "JULGADA"},
        {"JULGADO" + REPL, "JULGADO"},
        {"PROVID" + REPL + "O", "PROVIDO"},
        {"IMPROVID" + REPL + "O", "IMPROVIDO"},
        {"M" + REPL + "ESMO", "MESMO"},
        {"VAR" + REPL + "A", "VARA"},
        {"TURMA", "TURMA"},
        {"REGI" + REPL + "O", "REGIÃO"},
        {"REGIAO", "REGIÃO"},
        {"1" + REPL + " ", "1ª "},
        {"2" + REPL + " ", "2ª "},
        {"3" + REPL + " ", "3ª "},
    };

    private static final String[][] SUBSTITUICOES_LEXICO = {
        {"NÃO MESMO", "NO MESMO"},
        {"NO CONHE", "NÃO CONHE"},
        {" POR INADMISSIVEL", " POR INADMISSÍVEL"},
        {"GRATUIDADE DA JUSTIA", "GRATUIDADE DA JUSTIÇA"},
        {"GRATUIDADE DA JUSTIVA", "GRATUIDADE DA JUSTIÇA"},
        {"DESCISOES", "DECISÕES"},
        {"DECISO", "DECISÃO"},
        {"CONHEO", "CONHEÇO"},
        {"CONCESSO", "CONCESSÃO"},
        {"CAMAARA", "CÂMARA"},
        {"CMARA", "CÂMARA"},
        {"CAMARA", "CÂMARA"},
        {"JUSTIA", "JUSTIÇA"},
        {"JUSTIVA", "JUSTIÇA"},
        {"INADMISSIVEL", "INADMISSÍVEL"},
        {"EXECUCAO", "EXECUÇÃO"},
        {"PENSAO", "PENSÃO"},
        {"COMPETENCIA", "COMPETÊNCIA"},
        {"INDENIZACAO", "INDENIZAÇÃO"},
        {"REPETICAO", "REPETIÇÃO"},
        {"INDEBITO", "INDÉBITO"},
        {"INQUERITO", "INQUÉRITO"},
        {"INTIMACAO", "INTIMAÇÃO"},
        {"PUBLICACAO", "PUBLICAÇÃO"},
        {"PETICAO", "PETIÇÃO"},
        {"SENTENCA", "SENTENÇA"},
        {"REGIAO", "REGIÃO"},
        {"TRANSITO", "TRÂNSITO"},
        {"TRNSITO", "TRÂNSITO"},
        {" DE GOIAS", " DE GOIÁS"},
        {" GOIAS", " GOIÁS"},
        {"ANAPOLIS", "ANÁPOLIS"},
    };

    private PortuguesTextoCorrecaoUtil() {}

    /** Mojibake + U+FFFD + léxico jurídico comum. */
    public static String normalizar(String s) {
        if (s == null) {
            return null;
        }
        String cur = Utf8MojibakeUtil.corrigir(s);
        cur = corrigirCaractereSubstituicao(cur);
        cur = corrigirLexicoJuridico(cur);
        cur = MULTI_SPACE.matcher(cur).replaceAll(" ");
        return cur.trim();
    }

    static String corrigirCaractereSubstituicao(String s) {
        if (s == null || !s.contains(REPL)) {
            return s;
        }
        String t = s;
        for (String[] pair : SUBSTITUICOES_REPLACEMENT) {
            t = t.replace(pair[0], pair[1]);
        }
        if (t.contains(REPL)) {
            t = t.replace(REPL, "");
        }
        return t;
    }

    static String corrigirLexicoJuridico(String s) {
        if (s == null || s.isEmpty()) {
            return s;
        }
        String t = s;
        for (String[] pair : SUBSTITUICOES_LEXICO) {
            t = replaceIgnoreCase(t, pair[0], pair[1]);
        }
        return t;
    }

    private static String replaceIgnoreCase(String text, String from, String to) {
        if (!text.toUpperCase(Locale.ROOT).contains(from.toUpperCase(Locale.ROOT))) {
            return text;
        }
        return Pattern.compile(Pattern.quote(from), Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE)
                .matcher(text)
                .replaceAll(to);
    }
}
