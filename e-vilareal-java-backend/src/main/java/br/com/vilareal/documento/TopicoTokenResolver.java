package br.com.vilareal.documento;

import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Resolve os tokens <em>inline</em> {@code {{...}}} de um HTML de tópico (formato novo gerado pela F5)
 * a partir de um {@link ProcessamentoContexto}.
 *
 * <p>Resolve {@code {{flex:...}}}, {@code {{plural:...}}}, {@code {{totalDebito}}} (R$ + extenso),
 * {@code {{totalDebitoExtenso}}}, {@code {{unidade}}},
 * {@code {{qualifica:...}}}, {@code {{nome:...}}} e {@code {{pergunta:...}}}. O token {@code {{debitos:...}}}
 * é deixado <strong>intacto</strong> (resolvido na fase de montagem). Tokens desconhecidos/malformados são
 * preservados e logados — nunca lançam exceção.
 */
public final class TopicoTokenResolver {

    private static final Logger log = LoggerFactory.getLogger(TopicoTokenResolver.class);

    /** grupo 1 = tipo; grupo 2 = corpo (sem as chaves). */
    private static final Pattern TOKEN = Pattern.compile("\\{\\{([a-zA-Z]+)(?::([^}]*))?\\}\\}");

    private TopicoTokenResolver() {
    }

    /**
     * Contexto de resolução. Quem descobre gênero/número dos polos, a unidade, o total e as
     * qualificações/nomes/respostas é o <em>service</em> da petição; este resolvedor só consome.
     */
    public record ProcessamentoContexto(
            FlexaoUtil.Genero generoAutor,
            FlexaoUtil.Numero numeroAutor,
            FlexaoUtil.Genero generoReu,
            FlexaoUtil.Numero numeroReu,
            FlexaoUtil.Numero numeroTitulos,
            String unidade,
            String totalDebitoFormatado,
            String totalDebitoExtenso,
            String qualificacaoAutor,
            String qualificacaoReu,
            String nomeAutor,
            String nomeReu,
            Map<String, String> respostasPergunta) {
    }

    public static String resolver(String html, ProcessamentoContexto ctx) {
        if (html == null || html.isEmpty()) {
            return html;
        }
        Matcher m = TOKEN.matcher(html);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            String tipo = m.group(1).toLowerCase(Locale.ROOT);
            String corpo = m.group(2); // pode ser null para {{totalDebito}}/{{unidade}}
            String substituicao = resolverToken(tipo, corpo, m.group(), ctx);
            m.appendReplacement(sb, Matcher.quoteReplacement(substituicao));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private static String resolverToken(String tipo, String corpo, String original, ProcessamentoContexto ctx) {
        switch (tipo) {
            case "flex":
                return resolverFlex(corpo, original, ctx);
            case "plural":
                return resolverPlural(corpo, original, ctx);
            case "totaldebito":
                return formatarTotalDebito(ctx);
            case "totaldebitoextenso":
                return nvl(ctx.totalDebitoExtenso());
            case "unidade":
                return nvl(ctx.unidade());
            case "qualifica":
                return resolverPolo(corpo, ctx.qualificacaoAutor(), ctx.qualificacaoReu(), original);
            case "nome":
                return resolverPolo(corpo, ctx.nomeAutor(), ctx.nomeReu(), original);
            case "pergunta":
                return resolverPergunta(corpo, ctx);
            case "debitos":
                // Resolvido na fase de montagem; preservar intacto.
                return original;
            default:
                log.warn("Token de tipo desconhecido preservado: {}", original);
                return original;
        }
    }

    private static String resolverFlex(String corpo, String original, ProcessamentoContexto ctx) {
        String[] p = partes(corpo);
        if (p == null) {
            log.warn("Token flex malformado preservado: {}", original);
            return original;
        }
        String alvo = p[0];
        String lema = p[1];
        String caixa = p[2];
        FlexaoUtil.Genero genero = generoDoAlvo(alvo, ctx);
        FlexaoUtil.Numero numero = numeroDoAlvo(alvo, ctx);
        if (genero == null || numero == null) {
            log.warn("Alvo desconhecido em flex ({}): preservando lema sem flexionar", original);
            return aplicarCaixa(lema, caixa);
        }
        return aplicarCaixa(FlexaoUtil.adequar(lema, genero, numero), caixa);
    }

    private static String resolverPlural(String corpo, String original, ProcessamentoContexto ctx) {
        String[] p = partes(corpo);
        if (p == null) {
            log.warn("Token plural malformado preservado: {}", original);
            return original;
        }
        String alvo = p[0];
        String lema = p[1];
        String caixa = p[2];
        FlexaoUtil.Numero numero = numeroDoAlvo(alvo, ctx);
        if (numero == null) {
            log.warn("Alvo desconhecido em plural ({}): preservando lema sem flexionar", original);
            return aplicarCaixa(lema, caixa);
        }
        return aplicarCaixa(FlexaoUtil.pluralizar(lema, numero), caixa);
    }

    private static String resolverPolo(String corpo, String valorAutor, String valorReu, String original) {
        String alvo = corpo == null ? "" : corpo.trim().toLowerCase(Locale.ROOT);
        if ("autor".equals(alvo)) {
            return nvl(valorAutor);
        }
        if ("reu".equals(alvo)) {
            return nvl(valorReu);
        }
        log.warn("Alvo desconhecido preservado: {}", original);
        return original;
    }

    private static String resolverPergunta(String corpo, ProcessamentoContexto ctx) {
        String rotulo = corpo == null ? "" : corpo.trim();
        Map<String, String> respostas = ctx.respostasPergunta();
        if (respostas == null || !respostas.containsKey(rotulo)) {
            log.warn("Pergunta sem resposta no contexto, substituindo por vazio: '{}'", rotulo);
            return "";
        }
        return nvl(respostas.get(rotulo));
    }

    /** Divide "ALVO:LEMA" ou "ALVO:LEMA|CAIXA" em [alvo, lema, caixa]; null se malformado. */
    private static String[] partes(String corpo) {
        if (corpo == null || corpo.isEmpty()) {
            return null;
        }
        String caixa = "";
        String semCaixa = corpo;
        int barra = corpo.indexOf('|');
        if (barra >= 0) {
            caixa = corpo.substring(barra + 1).trim().toLowerCase(Locale.ROOT);
            semCaixa = corpo.substring(0, barra);
        }
        int doisPontos = semCaixa.indexOf(':');
        if (doisPontos < 0) {
            return null;
        }
        String alvo = semCaixa.substring(0, doisPontos).trim().toLowerCase(Locale.ROOT);
        String lema = semCaixa.substring(doisPontos + 1).trim();
        if (alvo.isEmpty() || lema.isEmpty()) {
            return null;
        }
        return new String[] {alvo, lema, caixa};
    }

    private static FlexaoUtil.Genero generoDoAlvo(String alvo, ProcessamentoContexto ctx) {
        if ("autor".equals(alvo)) {
            return ctx.generoAutor();
        }
        if ("reu".equals(alvo)) {
            return ctx.generoReu();
        }
        return null;
    }

    private static FlexaoUtil.Numero numeroDoAlvo(String alvo, ProcessamentoContexto ctx) {
        if ("autor".equals(alvo)) {
            return ctx.numeroAutor();
        }
        if ("reu".equals(alvo)) {
            return ctx.numeroReu();
        }
        if ("titulo".equals(alvo)) {
            return ctx.numeroTitulos();
        }
        return null;
    }

    private static String aplicarCaixa(String valor, String caixa) {
        if (valor == null || valor.isEmpty() || caixa == null || caixa.isEmpty()) {
            return valor == null ? "" : valor;
        }
        switch (caixa) {
            case "lower":
                return valor.toLowerCase(Locale.ROOT);
            case "upper":
                return valor.toUpperCase(Locale.ROOT);
            case "proper":
                // Capitaliza só a primeira letra; demais em minúsculas.
                return Character.toUpperCase(valor.charAt(0)) + valor.substring(1).toLowerCase(Locale.ROOT);
            default:
                return valor;
        }
    }

    private static String formatarTotalDebito(ProcessamentoContexto ctx) {
        String formatado = nvl(ctx.totalDebitoFormatado());
        String extenso = nvl(ctx.totalDebitoExtenso());
        if (formatado.isEmpty()) {
            return extenso;
        }
        if (extenso.isEmpty()) {
            return formatado;
        }
        return formatado + " (" + extenso + ")";
    }

    private static String nvl(String s) {
        return s == null ? "" : s;
    }
}
