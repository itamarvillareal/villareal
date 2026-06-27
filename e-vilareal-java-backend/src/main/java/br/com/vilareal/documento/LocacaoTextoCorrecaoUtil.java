package br.com.vilareal.documento;

import br.com.vilareal.common.text.EAgudoCorrompidoCorrecaoUtil;
import br.com.vilareal.common.text.PortuguesTextoCorrecaoUtil;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Normalização de grafia, acentos e redação do contrato de locação após processamento legado.
 * Preserva quebras de linha (parágrafos §).
 */
public final class LocacaoTextoCorrecaoUtil {

    private static final Pattern ESPACOS_HORIZONTAIS = Pattern.compile("[ \\t\\f\\r]{2,}");
    private static final Pattern PARAGRAFO_TAB = Pattern.compile("(§\\d+º)\\s*\\t");
    private static final Pattern SECAO_QUEBRADA = Pattern.compile("\uFFFD(\\d+º)");

    private static final String[][] SUBSTITUICOES_LOCACAO = {
        {"anapolis-go", "Anápolis-GO"},
        {"prefeitura de anapolis", "prefeitura de Anápolis"},
        {"cidade de anapolis", "cidade de Anápolis"},
        {"locacao", "locação"},
        {"imovel", "imóvel"},
        {"imoveis", "imóveis"},
        {"desocupacao", "desocupação"},
        {"ocupacao", "ocupação"},
        {"utilizacao", "utilização"},
        {"desapropriacao", "desapropriação"},
        {"comunicacao", "comunicação"},
        {"comunicacoes", "comunicações"},
        {"procuracao", "procuração"},
        {"inscricao", "inscrição"},
        {"legislacao", "legislação"},
        {"rescisao", "rescisão"},
        {"fianca", "fiança"},
        {"mudanca", "mudança"},
        {"correcao", "correção"},
        {"atualizacao", "atualização"},
        {"invocavel", "invocável"},
        {"eletrica", "elétrica"},
        {"eletrico", "elétrico"},
        {"tambem", "também"},
        {"nao ", "não "},
        {" nao ", " não "},
        {" nao,", " não,"},
        {" nao.", " não."},
        {" nao;", " não;"},
        {" de goias", " de Goiás"},
    };

    private LocacaoTextoCorrecaoUtil() {}

    /** Mojibake, léxico jurídico/locação e redação conhecida do modelo legado. */
    public static String normalizar(String texto) {
        if (!StringUtils.hasText(texto)) {
            return texto != null ? texto : "";
        }
        String t = PortuguesTextoCorrecaoUtil.normalizarPreservandoQuebras(texto);
        t = EAgudoCorrompidoCorrecaoUtil.corrigir(t);
        t = corrigirLexicoLocacao(t);
        t = corrigirGrafiaGramaticaLocacao(t);
        t = normalizarMarcadoresParagrafo(t);
        return t;
    }

    static String corrigirLexicoLocacao(String texto) {
        String t = texto;
        for (String[] pair : SUBSTITUICOES_LOCACAO) {
            t = replaceIgnoreCase(t, pair[0], pair[1]);
        }
        return normalizarGrafiaAnapolisGo(t);
    }

    /** Após {@link br.com.vilareal.common.text.PortuguesTextoCorrecaoUtil}, «ANÁPOLIS-go» vira «Anápolis-GO». */
    static String normalizarGrafiaAnapolisGo(String texto) {
        if (!StringUtils.hasText(texto)) {
            return texto != null ? texto : "";
        }
        return texto
                .replaceAll("(?i)ANÁPOLIS-go", "Anápolis-GO")
                .replaceAll("(?i)cidade de ANÁPOLIS-GO", "cidade de Anápolis-GO")
                .replaceAll("(?i)Foro da cidade de ANÁPOLIS-GO", "Foro da cidade de Anápolis-GO")
                .replaceAll("(?i)prefeitura de ANÁPOLIS", "prefeitura de Anápolis");
    }

    /** Redação fixa do modelo «GERAL - Multa fixa» e variantes comuns pós-processamento. */
    static String corrigirGrafiaGramaticaLocacao(String texto) {
        if (!StringUtils.hasText(texto)) {
            return texto != null ? texto : "";
        }
        return texto
                .replaceAll("(?i)jÃ¡\\s+fica\\s+autorizado\\s+a\\s+cobrança", "já fica autorizada a cobrança")
                .replaceAll("(?i),\\s{2,}já\\s+fica\\s+autorizado\\s+a\\s+cobrança", ", já fica autorizada a cobrança")
                .replaceAll("(?i)já\\s+fica\\s+autorizado\\s+a\\s+cobrança", "já fica autorizada a cobrança")
                .replaceAll("(?i)em\\s+atendimento\\s+à\\s+esta\\s+cláusula", "em atendimento a esta cláusula")
                .replaceAll(
                        "(?i)E\\s+por\\s+estarem\\s+justos\\s+e\\s+contratados\\s+as\\s+partes",
                        "E por estarem justas e contratadas, as partes")
                .replaceAll("(?i)\\bt[eêë]?m\\s+por\\s+justo", "têm por justo")
                .replaceAll("(?i)\\bOS (Locatários|Locatárias|Locatarios|Locatarias)\\b", "Os $1")
                .replaceAll("(?i)Propercase\\(\\s*S\\s*\\)\\s*ublocar", "Sublocar")
                .replaceAll("(?i)\\bS\\s+ublocar\\b", "Sublocar")
                .replaceAll(
                        "(?i)devendo fazer o pagamento por igual período de meses da locação, ou seja,",
                        "devendo pagar a mesma quantidade de taxas condominiais correspondente ao número de meses da locação, ou seja,");
    }

    static String normalizarMarcadoresParagrafo(String texto) {
        if (!StringUtils.hasText(texto)) {
            return texto != null ? texto : "";
        }
        String t = PARAGRAFO_TAB.matcher(texto).replaceAll("$1 ");
        t = SECAO_QUEBRADA.matcher(t).replaceAll("§$1");
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
