package br.com.vilareal.documento;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Motor de texto do capítulo "DOS DÉBITOS" da petição de Execução de Taxa Condominial.
 *
 * <p>Porte fiel da macro VBA {@code Calculos_da_Planilha_de_Calculos}: recebe a lista de títulos já
 * calculados (valores em {@link BigDecimal}) e devolve um parágrafo HTML por título + o total geral.
 *
 * <p>Classe pura, sem Spring/banco. Quem busca os títulos da rodada e parseia as strings "R$ ..." é o
 * <em>service</em> da fase seguinte.
 */
public final class DebitosTextoBuilder {

    private DebitosTextoBuilder() {
    }

    public enum ModoDebito {
        COMPLETO,
        RESUMIDO
    }

    /**
     * Um título já calculado. Valores em BigDecimal (o service parseia as strings "R$ ..." antes).
     *
     * <p>{@code totalInformado} é o total do título <em>exatamente como exibido na tela de cálculos</em>
     * (INV1 — fidelidade total). Quando presente, é usado no texto sem recomposição por soma; quando
     * {@code null}, o builder recompõe somando os componentes (fallback retrocompatível).
     */
    public record TituloDebitoInput(
            String descricao,
            String vencimento,
            int diasAtraso,
            BigDecimal valorPrincipal,
            BigDecimal atualizacaoMonetaria,
            BigDecimal juros,
            BigDecimal multa,
            BigDecimal honorarios,
            BigDecimal totalInformado) {

        /** Construtor de compatibilidade: sem total informado (recompõe por soma). */
        public TituloDebitoInput(
                String descricao,
                String vencimento,
                int diasAtraso,
                BigDecimal valorPrincipal,
                BigDecimal atualizacaoMonetaria,
                BigDecimal juros,
                BigDecimal multa,
                BigDecimal honorarios) {
            this(descricao, vencimento, diasAtraso, valorPrincipal, atualizacaoMonetaria, juros, multa,
                    honorarios, null);
        }
    }

    public record DebitosParams(
            ModoDebito modo,
            String modalidade,
            String dataCalculoTexto,
            String indice,
            String multa,
            String juros,
            String periodicidade) {
    }

    public record CapituloDebitos(
            String cabecalhoHtml,
            List<String> itensHtml,
            BigDecimal totalGeral,
            String totalGeralFormatado,
            String totalGeralExtenso) {
    }

    public static CapituloDebitos montar(List<TituloDebitoInput> titulos, DebitosParams params) {
        return montar(titulos, params, null);
    }

    /**
     * @param totalGeralInformado total geral <em>exato da tela</em> (INV1). Quando {@code null}, o total
     *                            geral é recomposto somando os totais por título (fallback).
     */
    public static CapituloDebitos montar(
            List<TituloDebitoInput> titulos, DebitosParams params, BigDecimal totalGeralInformado) {
        List<String> itens = new ArrayList<>();
        BigDecimal totalGeralSomado = BigDecimal.ZERO;

        List<TituloDebitoInput> lista = titulos != null ? titulos : List.of();
        for (TituloDebitoInput titulo : lista) {
            // INV1: usa o total da tela quando informado; só recompõe por soma como fallback.
            BigDecimal totalItem = titulo.totalInformado() != null
                    ? titulo.totalInformado().setScale(2, RoundingMode.HALF_UP)
                    : totalItem(titulo);
            totalGeralSomado = totalGeralSomado.add(totalItem);
            itens.add(montarItemHtml(titulo, params, totalItem));
        }

        BigDecimal totalGeral = totalGeralInformado != null
                ? totalGeralInformado.setScale(2, RoundingMode.HALF_UP)
                : totalGeralSomado.setScale(2, RoundingMode.HALF_UP);
        return new CapituloDebitos(
                montarCabecalhoHtml(params),
                itens,
                totalGeral,
                formatBRL(totalGeral),
                ValorExtensoUtil.reaisPorExtenso(totalGeral));
    }

    /**
     * Cabeçalho do capítulo "DOS DÉBITOS" montado a partir da config de cálculo do cliente
     * (índice, multa, juros e periodicidade) — nada chumbado. Retorna só o conteúdo do parágrafo
     * (sem {@code <p>}), igual aos {@code itensHtml}.
     */
    private static String montarCabecalhoHtml(DebitosParams params) {
        String indice = params != null ? nullToEmpty(params.indice()).trim() : "";
        String multa = params != null ? normalizarPercentual(params.multa()) : "";
        String juros = params != null ? normalizarPercentual(params.juros()) : "";
        String periodo = mapearPeriodo(params != null ? params.periodicidade() : null);
        String url = "http://www.tjdft.jus.br/servicos/atualizacao-monetaria-1/calculo";

        return esc("O crédito Executado é composto pela soma dos valores dos títulos, acrescentados pela "
                        + "atualização monetária do índice " + indice + ", seguindo as diretrizes idênticas ao "
                        + "cálculo disponível no site do TJDFT (")
                + "<span class=\"url-ref\"><u>" + esc(url) + "</u></span>"
                + esc("), multa legal de " + multa + "%, juros de " + juros + "% ao " + periodo
                        + " e honorários, tudo conforme abaixo discriminados:");
    }

    /** Extrai apenas o número (remove espaços e {@code %}), preservando casas decimais com vírgula. */
    private static String normalizarPercentual(String valor) {
        if (valor == null) {
            return "";
        }
        return valor.replaceAll("[^0-9,]", "");
    }

    /** mensal → mês; diaria/diária → dia; anual → ano; vazio/desconhecido → mês (default). */
    private static String mapearPeriodo(String periodicidade) {
        String p = deAccent(nullToEmpty(periodicidade)).trim().toLowerCase(Locale.ROOT);
        return switch (p) {
            case "diaria" -> "dia";
            case "anual" -> "ano";
            case "mensal" -> "mês";
            default -> "mês";
        };
    }

    private static BigDecimal totalItem(TituloDebitoInput t) {
        return nz(t.atualizacaoMonetaria())
                .add(nz(t.valorPrincipal()))
                .add(nz(t.juros()))
                .add(nz(t.multa()))
                .add(nz(t.honorarios()))
                .setScale(2, RoundingMode.HALF_UP);
    }

    private static String montarItemHtml(TituloDebitoInput t, DebitosParams params, BigDecimal totalItem) {
        boolean diversos = params.modalidade() != null && params.modalidade().trim().equalsIgnoreCase("Diversos");

        VocabuloItem voc = resolverVocabulos(t.descricao(), params.modalidade(), diversos);

        String diasAtrasoExtenso = ValorExtensoUtil.numeroPorExtenso(t.diasAtraso());

        String prefix = voc.inicial()
                + nullToEmpty(t.vencimento())
                + ", com " + t.diasAtraso() + " (" + diasAtrasoExtenso + ") dias de atraso, ";

        String html;
        if (params.modo() == ModoDebito.RESUMIDO) {
            String valorSeg = "no valor principal de " + valorComExtenso(nz(t.valorPrincipal()));
            String totalSeg = "Com os encargos incidentes, tudo perfaz o montante de "
                    + valorComExtenso(totalItem);
            html = esc(prefix)
                    + "<u>" + valorSeg + "</u>"
                    + esc(". ")
                    + "<strong><u>" + totalSeg + "</u></strong>"
                    + esc(voc.fim());
        } else {
            String valorSeg = "no valor de " + valorComExtenso(nz(t.valorPrincipal()));
            String midBlock = ". "
                    + montarAtualHonorarios(t, params)
                    + montarMulta(t)
                    + montarJuros(t)
                    + ". ";
            String totalSeg = "Tudo perfaz o montante de " + valorComExtenso(totalItem);
            html = esc(prefix)
                    + "<u>" + valorSeg + "</u>"
                    + midBlock
                    + "<strong><u>" + totalSeg + "</u></strong>"
                    + esc(voc.fim());
        }

        return limparPontos(html);
    }

    /**
     * Frase da atualização monetária + honorários (modo COMPLETO).
     *
     * <p>INV2: cada encargo zerado é <strong>omitido por completo</strong> (nenhuma frase). INV3: não há
     * mais a frase legada contraditória ("...não corresponde a um valor expressivo, bem como, não se
     * aplicam honorários") — a ausência do encargo é expressa apenas pela omissão.
     */
    private static String montarAtualHonorarios(TituloDebitoInput t, DebitosParams params) {
        String data = nullToEmpty(params.dataCalculoTexto());
        StringBuilder sb = new StringBuilder();
        if (temValor(t.atualizacaoMonetaria())) {
            sb.append("O valor da atualização monetária para a data de hoje (").append(data)
                    .append("), corresponde a ").append(valorComExtenso(nz(t.atualizacaoMonetaria())))
                    .append(". ");
        }
        if (temValor(t.honorarios())) {
            sb.append(". Pelos honorários ").append(valorComExtenso(nz(t.honorarios()))).append(". ");
        }
        return sb.toString();
    }

    private static String montarMulta(TituloDebitoInput t) {
        if (temValor(t.multa())) {
            return ". O valor da multa é " + valorComExtenso(nz(t.multa()));
        }
        return "";
    }

    /** INV2: juros zerados são omitidos por completo (sem a frase "não somaram nenhum valor"). */
    private static String montarJuros(TituloDebitoInput t) {
        if (temValor(t.juros())) {
            return ". Os juros legais na proporção de 1% (um por cento) ao mês perfazem o total de "
                    + valorComExtenso(nz(t.juros())) + ". ";
        }
        return "";
    }

    /** Evita quebra entre «R$ …» e «(»; o extenso pode quebrar linha no PDF. */
    private static String valorComExtenso(BigDecimal valor) {
        return "<span class=\"valor-monetario\"><span class=\"valor-monetario-num\">"
                + esc(formatBRL(nz(valor)))
                + "</span> ("
                + esc(ValorExtensoUtil.reaisPorExtenso(nz(valor)))
                + ")</span>";
    }

    /** Encargo presente = valor não nulo e diferente de zero (comparação numérica, não de string). */
    private static boolean temValor(BigDecimal v) {
        return nz(v).compareTo(BigDecimal.ZERO) != 0;
    }

    private record VocabuloItem(String inicial, String fim) {
    }

    private static VocabuloItem resolverVocabulos(String descricao, String modalidade, boolean diversos) {
        String base = diversos ? descricao : modalidade;
        String upper = base == null ? "" : base.trim().toUpperCase(Locale.ROOT);

        String inicial;
        boolean generico = false;
        switch (upper) {
            case "MENSALIDADE" -> inicial = "Mensalidade vencida em ";
            case "DIAS DE USO" -> inicial = "Os dias utilizados com cálculo a partir de ";
            case "TAXA DE ADESÃO" -> inicial = "A taxa de adesão em débito desde ";
            case "MULTA FIDELIZAÇÃO", "MULTA RESCISÓRIA" ->
                    inicial = "Multa por quebra de fidelidade exigível a partir de ";
            case "EQUIPAMENTO", "EQUIPAMENTOS" ->
                    inicial = "O valor do equipamento, devidamente atualizado a partir de ";
            default -> {
                if (!diversos) {
                    inicial = modalidade != null ? modalidade : "";
                } else {
                    generico = true;
                    inicial = properCase(descricao) + " vencido em ";
                }
            }
        }

        // Replaces finais (paridade VBA).
        inicial = inicial.replace("Taxa Condominial vencido em ", "Taxa Condominial vencida em ");
        inicial = inicial.replace("Taxa de Mudança ", "Taxa de Mudança vencida em ");

        String fim;
        if (generico) {
            fim = ", por este débito;";
        } else if (diversos) {
            fim = ";";
        } else {
            fim = ", por este título;";
        }
        return new VocabuloItem(inicial, fim);
    }

    private static String properCase(String s) {
        if (s == null || s.isBlank()) {
            return "";
        }
        String[] palavras = s.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < palavras.length; i++) {
            String p = palavras[i];
            if (i > 0) {
                sb.append(" ");
            }
            if (p.isEmpty()) {
                continue;
            }
            sb.append(Character.toUpperCase(p.charAt(0)));
            if (p.length() > 1) {
                sb.append(p.substring(1).toLowerCase(Locale.ROOT));
            }
        }
        return sb.toString();
    }

    private static String formatBRL(BigDecimal valor) {
        BigDecimal v = (valor == null ? BigDecimal.ZERO : valor).setScale(2, RoundingMode.HALF_UP);
        DecimalFormatSymbols simbolos = new DecimalFormatSymbols(Locale.ROOT);
        simbolos.setDecimalSeparator(',');
        simbolos.setGroupingSeparator('.');
        DecimalFormat df = new DecimalFormat("#,##0.00", simbolos);
        return "R$ " + df.format(v);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private static String deAccent(String s) {
        if (s == null) {
            return "";
        }
        return java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }

    private static String nullToEmpty(String s) {
        return s != null ? s : "";
    }

    /** Limpa as sequências ". . " geradas pela concatenação literal (paridade VBA). */
    private static String limparPontos(String texto) {
        String t = texto;
        while (t.contains(". . ")) {
            t = t.replace(". . ", ". ");
        }
        return t;
    }

    private static String esc(String texto) {
        if (texto == null) {
            return "";
        }
        return texto
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
