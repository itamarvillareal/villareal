package br.com.vilareal.documento;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Conversor puro de um bloco de tópico no formato legado (stream do VBA) para o formato novo
 * {@code {classe, html}}: classe semântica do parágrafo + HTML de formatação + tokens {@code {{...}}}
 * para as partes dinâmicas.
 *
 * <p>Formato legado de um bloco:
 * <pre>("TIPO")(par1)(par2)...(parN) TEXTO-BASE</pre>
 * onde as 8 primeiras posições de par são formatação (1 itálico · 2 negrito · 3 sublinhado ·
 * 4 vermelho · 5 fundo amarelo · 6 fundo azul-claro · 7 fundo azul-escuro · 8 fundo laranja).
 * Posições além da 8ª são campos legados extras e são ignoradas. Em cada par preenchido, o trecho a
 * formatar é o que está entre {@code +++} e {@code /\}; o resto do par é contexto para localizá-lo no
 * texto-base. O texto-base vem limpo (sem {@code +++ /\}) e pode conter funções legadas.
 *
 * <p>Classe pura: sem Spring, sem banco. Não altera nada — só transforma texto.
 */
public final class TopicoLegadoConversor {

    private TopicoLegadoConversor() {}

    public record TopicoConvertido(String classe, String html) {}

    private static final System.Logger LOG = System.getLogger(TopicoLegadoConversor.class.getName());

    private static final String MARK_OPEN = "+++";
    private static final String MARK_CLOSE = "/\\"; // '/' seguido de '\'

    /** Formatação por posição (1..8); índice 0 não usado. {abreTag, fechaTag}. */
    private static final String[][] FORMATO = {
        null,
        {"<em>", "</em>"},
        {"<strong>", "</strong>"},
        {"<u>", "</u>"},
        {"<span class=\"txt-vermelho\">", "</span>"},
        {"<span class=\"fundo-amarelo\">", "</span>"},
        {"<span class=\"fundo-azul-claro\">", "</span>"},
        {"<span class=\"fundo-azul-escuro\">", "</span>"},
        {"<span class=\"fundo-laranja\">", "</span>"},
    };

    private static final Pattern P_ADEQUA = Pattern.compile(
            "Adequa\\(\\s*\"@\"\\s*,\\s*\"(Autor|Reu)\"\\s*,\\s*\"([^\"]*)\"\\s*\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern P_PLURAL = Pattern.compile(
            "Verifica_Plural\\(\\s*\"@\"\\s*,\\s*\"([^\"]*)\"\\s*,\\s*\"([^\"]*)\"\\s*\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern P_TOTAL = Pattern.compile(
            "RetornaValorTotalDoDebito\\(\\s*\"@\"\\s*,\\s*\"@\"\\s*\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern P_UNIDADE = Pattern.compile(
            "RetornaUnidade\\(\\s*\"@\"\\s*,\\s*\"@\"\\s*\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern P_NOME = Pattern.compile(
            "Nome\\(\\s*\"(Autor|Reu)\"\\s*,\\s*\"all\"\\s*\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern P_QUALIFICA = Pattern.compile(
            "Qualifica_Sem_Nome_\\(\\s*\"(Autor|Reu)\"\\s*,\\s*\"all\"\\s*\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern P_PERGUNTA = Pattern.compile(
            "Pergunta_na_Caixa\\(\\s*\"([^\"]*)\"[^)]*\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern P_MACRO = Pattern.compile(
            "CallMacro\\(\\[[^\\]]*\\]\\.Calculos_da_Planilha_de_Calculos\\s*\\(\\s*\"([^\"]*)\"\\s*,\\s*"
                    + "\"([^\"]*)\"\\s*,\\s*\"([^\"]*)\"\\s*\\)\\s*\\)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern P_WRAP = Pattern.compile(
            "(Lcase|Ucase|Propercase)\\(\\s*\\{\\{([^{}]*)\\}\\}\\s*\\)", Pattern.CASE_INSENSITIVE);

    public static TopicoConvertido converter(String blocoLegado) {
        Parsed p = parse(blocoLegado != null ? blocoLegado : "");
        String classe = classeDoTipo(p.tipo);

        // texto-base: escapar &<> ANTES e então converter funções em tokens.
        String baseConv = tokenizar(esc(p.base));

        // Agrupar formatação por (contexto, alvo) para permitir aninhamento (ex.: negrito + sublinhado).
        Map<String, GrupoFmt> grupos = new LinkedHashMap<>();
        for (int idx = 0; idx < p.campos.size(); idx++) {
            int pos = idx + 1;
            if (pos > 8) {
                break; // apenas 8 posições de formatação; extras legados ignorados
            }
            String campo = stripQuotes(p.campos.get(idx));
            int o = campo.indexOf(MARK_OPEN);
            if (o < 0) {
                continue; // par vazio ou sem marcador → sem formatação
            }
            int c = campo.indexOf(MARK_CLOSE, o + MARK_OPEN.length());
            if (c < 0) {
                LOG.log(System.Logger.Level.WARNING, "Par com '+++' sem fechamento '/\\': {0}", campo);
                continue;
            }
            String alvo = campo.substring(o + MARK_OPEN.length(), c);
            String contexto = campo.substring(0, o) + alvo + campo.substring(c + MARK_CLOSE.length());
            String alvoConv = tokenizar(esc(alvo));
            String ctxConv = tokenizar(esc(contexto));
            String chave = ctxConv + "\u0000" + alvoConv;
            grupos.computeIfAbsent(chave, k -> new GrupoFmt(ctxConv, alvoConv)).posicoes.add(pos);
        }

        for (GrupoFmt g : grupos.values()) {
            baseConv = aplicarFormatacao(baseConv, g);
        }

        return new TopicoConvertido(classe, baseConv);
    }

    // ---------------------------------------------------------------- parsing

    private static final class Parsed {
        String tipo = "";
        final List<String> campos = new ArrayList<>();
        String base = "";
    }

    private static Parsed parse(String bloco) {
        Parsed p = new Parsed();
        String s = bloco;
        int n = s.length();
        int i = 0;
        while (i < n && Character.isWhitespace(s.charAt(i))) {
            i++;
        }
        // tag de tipo
        if (i < n && s.charAt(i) == '(') {
            int end = matchGroup(s, i);
            if (end >= 0) {
                p.tipo = stripParens(s.substring(i, end + 1));
                i = end + 1;
            }
        }
        // a spec permite "(TIPO) (par1)"; tolera espaço entre a tag e o 1º par
        int j = i;
        while (j < n && Character.isWhitespace(s.charAt(j))) {
            j++;
        }
        if (j < n && s.charAt(j) == '(') {
            i = j;
        }
        // pares de formatação/contexto (adjacentes)
        while (i < n && s.charAt(i) == '(') {
            int end = matchGroup(s, i);
            if (end < 0) {
                break; // desbalanceado → resto é base
            }
            String conteudo = stripParens(s.substring(i, end + 1));
            String t = conteudo.trim();
            if (t.equals("...") || t.equals("\u2026")) {
                break; // reticências entre parênteses pertencem ao texto-base (citação legal)
            }
            p.campos.add(conteudo);
            i = end + 1;
        }
        p.base = s.substring(i);
        return p;
    }

    /** Índice do ')' que fecha o '(' em {@code open}, respeitando aninhamento; -1 se desbalanceado. */
    private static int matchGroup(String s, int open) {
        int depth = 0;
        for (int k = open; k < s.length(); k++) {
            char ch = s.charAt(k);
            if (ch == '(') {
                depth++;
            } else if (ch == ')') {
                depth--;
                if (depth == 0) {
                    return k;
                }
            }
        }
        return -1;
    }

    private static String stripParens(String g) {
        if (g.length() >= 2 && g.charAt(0) == '(' && g.charAt(g.length() - 1) == ')') {
            return g.substring(1, g.length() - 1);
        }
        return g;
    }

    private static String stripQuotes(String s) {
        String t = s;
        while (t.length() >= 2 && t.charAt(0) == '"' && t.charAt(t.length() - 1) == '"') {
            t = t.substring(1, t.length() - 1);
        }
        return t;
    }

    // ----------------------------------------------------------------- tipo

    private static String classeDoTipo(String tipoRaw) {
        String t = stripQuotes(tipoRaw != null ? tipoRaw.trim() : "");
        String norm = deAccent(t).toUpperCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
        switch (norm) {
            case "TITULO":
                return "titulo";
            case "N SEQUENCIAL":
                return "subtitulo";
            case "PARAGRAFO":
                return "paragrafo";
            case "RECUADO":
                return "recuado";
            case "PEDIDO":
                return "pedido";
            case "MACRO":
                return "macro";
            case "CABECALHO":
                return "cabecalho";
            case "CLAUSULA":
                return "clausula";
            case "TITULO CLAUSULA":
            case "TITULO_CLAUSULA":
                return "titulo-clausula";
            default:
                LOG.log(System.Logger.Level.WARNING, "Tipo de tópico desconhecido: ''{0}'' \u2192 paragrafo", t);
                return "paragrafo";
        }
    }

    // ---------------------------------------------------------------- tokens

    private static String tokenizar(String s) {
        String t = s;
        t = replaceAll(t, P_ADEQUA, m -> "{{flex:" + m.group(1).toLowerCase(Locale.ROOT) + ":" + m.group(2) + "}}");
        t = replaceAll(t, P_PLURAL,
                m -> "{{plural:" + deAccent(m.group(1)).toLowerCase(Locale.ROOT) + ":" + m.group(2) + "}}");
        t = replaceAll(t, P_TOTAL, m -> "{{totalDebito}}");
        t = replaceAll(t, P_UNIDADE, m -> "{{unidade}}");
        t = replaceAll(t, P_NOME, m -> "{{nome:" + m.group(1).toLowerCase(Locale.ROOT) + "}}");
        t = replaceAll(t, P_QUALIFICA, m -> "{{qualifica:" + m.group(1).toLowerCase(Locale.ROOT) + "}}");
        t = replaceAll(t, P_PERGUNTA, m -> "{{pergunta:" + m.group(1) + "}}");
        t = replaceAll(t, P_MACRO,
                m -> "{{debitos:" + m.group(2) + "|" + m.group(1) + "|" + m.group(3) + "}}");

        // wrappers de caixa (Lcase/Ucase/Propercase) em volta de um token já convertido
        boolean changed = true;
        while (changed) {
            String before = t;
            t = replaceAll(t, P_WRAP, m -> {
                String w = m.group(1).toLowerCase(Locale.ROOT);
                String suf = w.equals("lcase") ? "lower" : (w.equals("ucase") ? "upper" : "proper");
                return "{{" + m.group(2) + "|" + suf + "}}";
            });
            changed = !t.equals(before);
        }
        return t;
    }

    // ------------------------------------------------------------ formatação

    private static final class GrupoFmt {
        final String contexto;
        final String alvo;
        final List<Integer> posicoes = new ArrayList<>();

        GrupoFmt(String contexto, String alvo) {
            this.contexto = contexto;
            this.alvo = alvo;
        }
    }

    private static String aplicarFormatacao(String base, GrupoFmt g) {
        if (g.alvo.isEmpty()) {
            return base;
        }
        int idx = base.indexOf(g.contexto);
        if (idx < 0) {
            LOG.log(System.Logger.Level.WARNING, "Contexto de formatação não localizado no texto-base: ''{0}''",
                    g.contexto);
            return base;
        }
        int t = g.contexto.indexOf(g.alvo);
        if (t < 0) {
            LOG.log(System.Logger.Level.WARNING, "Alvo de formatação não localizado no contexto: ''{0}''", g.alvo);
            return base;
        }
        List<Integer> pos = new ArrayList<>(g.posicoes);
        Collections.sort(pos); // posição menor = tag mais externa
        StringBuilder abre = new StringBuilder();
        StringBuilder fecha = new StringBuilder();
        for (int pp : pos) {
            abre.append(FORMATO[pp][0]);
            fecha.insert(0, FORMATO[pp][1]);
        }
        // Espaços de borda do alvo ficam FORA das tags (a localização usou o alvo original).
        String miolo = g.alvo.strip();
        int ini = g.alvo.indexOf(miolo);
        String espacoEsq = ini > 0 ? g.alvo.substring(0, ini) : "";
        String espacoDir = ini >= 0 ? g.alvo.substring(ini + miolo.length()) : "";
        String wrapped = miolo.isEmpty() ? g.alvo : espacoEsq + abre + miolo + fecha + espacoDir;
        String novoCtx = g.contexto.substring(0, t) + wrapped + g.contexto.substring(t + g.alvo.length());
        return base.substring(0, idx) + novoCtx + base.substring(idx + g.contexto.length());
    }

    // --------------------------------------------------------------- helpers

    private static String replaceAll(String input, Pattern p, Function<Matcher, String> f) {
        Matcher m = p.matcher(input);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            m.appendReplacement(sb, Matcher.quoteReplacement(f.apply(m)));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private static String esc(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String deAccent(String s) {
        if (s == null) {
            return "";
        }
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }
}
