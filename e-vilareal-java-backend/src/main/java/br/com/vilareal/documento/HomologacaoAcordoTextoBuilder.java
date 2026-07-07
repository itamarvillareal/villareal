package br.com.vilareal.documento;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Monta o corpo HTML da petição de homologação de acordo (capítulos DOS FATOS, DO ACORDO e DOS PEDIDOS).
 *
 * <p>Classe pura, sem Spring/banco.
 */
public final class HomologacaoAcordoTextoBuilder {

    private static final DecimalFormat DF_BRL;

    static {
        DecimalFormatSymbols sym = new DecimalFormatSymbols(new Locale("pt", "BR"));
        sym.setGroupingSeparator('.');
        sym.setDecimalSeparator(',');
        DF_BRL = new DecimalFormat("#,##0.00", sym);
    }

    private HomologacaoAcordoTextoBuilder() {}

    public record BoletoLinha(BigDecimal valor, String vencimento) {}

    public record TituloLinha(String vencimento, BigDecimal valor) {}

    public record ClausulasConfig(
            BigDecimal multaPercent,
            BigDecimal jurosPercent,
            BigDecimal honorariosPercent,
            String formaPagamentoTexto,
            boolean incluirArt1335,
            boolean incluirIrrevogavel,
            boolean incluirDesistenciaRecursos,
            boolean incluirCustas90,
            boolean incluirArt922) {}

    public static String montarCorpoFatos(
            BigDecimal totalGeral, String totalGeralExtenso, String unidade, List<TituloLinha> titulos) {
        StringBuilder sb = new StringBuilder();
        sb.append("<p class=\"titulo\">DOS FATOS</p>");
        sb.append("<p class=\"paragrafo\">A Parte Oposta é devedora do valor total de ")
                .append(valorComExtenso(totalGeral, totalGeralExtenso))
                .append(", decorrente de débito de taxas condominiais e despesas com custas processuais relativos à ")
                .append(esc(unidade))
                .append(", do condomínio Exequente, vencidas em: ")
                .append(montarListaTitulos(titulos))
                .append(".</p>");
        sb.append("<p class=\"paragrafo\">Entretanto, após a propositura da presente demanda as partes ")
                .append("resolveram entabular acordo, nos termos do item seguinte.</p>");
        return sb.toString();
    }

    public static String montarCorpoAcordo(List<BoletoLinha> boletos, ClausulasConfig clausulas) {
        int qtd = boletos != null ? boletos.size() : 0;
        if (qtd < 1) {
            throw new IllegalArgumentException("Informe ao menos um boleto no plano de pagamento.");
        }

        String formaPag = nz(clausulas.formaPagamentoTexto()).trim();
        if (formaPag.isEmpty()) {
            formaPag = "liquidadas por intermédio do pagamento dos boletos bancários anexos";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("<p class=\"titulo\">DO ACORDO</p>");
        sb.append("<p class=\"paragrafo\">Em decorrência do crédito os litigantes celebram a presente ")
                .append("transação, onde o devedor se obriga a pagar o montante do débito em ")
                .append(formatarQuantidadeParcelas(qtd))
                .append(", ")
                .append(esc(formaPag))
                .append(".</p>");
        sb.append("<p class=\"paragrafo\">Os boletos serão confeccionados nos valores e datas ")
                .append("discriminados a seguir: ")
                .append(montarListaBoletos(boletos))
                .append(".</p>");

        sb.append("<p class=\"paragrafo\">O não pagamento ou atraso de qualquer das parcelas avençadas ")
                .append("no presente acordo acarretará <strong>VENCIMENTO INTEGRAL E ANTECIPADO DO ")
                .append("DÉBITO</strong>, inclusive em relação às parcelas vincendas e não pagas, independentemente ")
                .append("de qualquer notificação ou aviso prévio, sujeitando o Devedor, além da execução do ")
                .append("presente instrumento, ao pagamento de <strong>MULTA POR DESCUMPRIMENTO</strong> da ")
                .append("obrigação pecuniária, na quantia correspondente a ")
                .append(percentualComExtenso(clausulas.multaPercent()))
                .append(" sobre o valor total do acordo, sobre o qual incidirá correção monetária e juros à taxa de ")
                .append(percentualComExtenso(clausulas.jurosPercent()))
                .append(" ao mês, custas processuais e honorários advocatícios na base de ")
                .append(percentualComExtenso(clausulas.honorariosPercent()))
                .append(" sobre o valor do débito.</p>");

        sb.append("<p class=\"paragrafo\">Qualquer tolerância do Credor quanto ao descumprimento das ")
                .append("obrigações do presente acordo constituirá mera liberalidade, não configurando renúncia ")
                .append("ou novação da avença, que poderá ser exigida a qualquer tempo.</p>");
        sb.append("<p class=\"paragrafo\">Em não havendo o pagamento ora pactuado, o Credor se reserva ")
                .append("no direito de promover medida judicial contra o Acordante.</p>");
        sb.append("<p class=\"paragrafo\">Com a quitação das parcelas, as partes dão plena, geral e ")
                .append("irrevogável quitação ao objeto desta demanda.</p>");

        if (clausulas.incluirArt1335()) {
            sb.append("<p class=\"paragrafo\">Declaram as partes que o presente acordo de parcelamento do ")
                    .append("crédito condominial não cessa a inadimplência, sendo que direito estabelecido no Art. ")
                    .append("1.335, inciso III, do Código Civil, somente poderá ser exercido após a quitação integral ")
                    .append("da avença.</p>");
        }

        if (clausulas.incluirIrrevogavel()) {
            sb.append("<p class=\"paragrafo\">O presente acordo é firmado em caráter irrevogável e irretratável, ")
                    .append("assinado em 02 (duas) vias de igual teor, obrigando-se as partes por si, seus herdeiros ")
                    .append("ou sucessores.</p>");
        }

        if (clausulas.incluirDesistenciaRecursos()) {
            sb.append("<p class=\"paragrafo\">As partes declaram que, em razão da composição alcançada nestes ")
                    .append("autos, não possuem interesse recursal, desistindo desde logo dos recursos e ")
                    .append("incidentes decorrentes do presente litígio, bem como do prazo de recurso contra a r. ")
                    .append("Decisão que homologar o presente acordo, nos termos do artigo 487, III, 'b' do CPC, de ")
                    .append("forma a permitir que produza seus efeitos jurídico e legais.</p>");
        }

        return sb.toString();
    }

    public static String montarCorpoPedidos(ClausulasConfig clausulas) {
        StringBuilder sb = new StringBuilder();
        sb.append("<p class=\"titulo\">DOS PEDIDOS</p>");
        sb.append("<p class=\"paragrafo\">Diante do exposto, requer de Vossa Excelência:</p>");
        sb.append("<p class=\"pedido\">Seja o acordo noticiado homologado por sentença, para que ")
                .append("surta seus efeitos jurídicos e legais, sendo o feito extinto com resolução do mérito, com ")
                .append("fulcro no artigo 487, inciso III, alínea ”b)“ do Código de Processo Civil.</p>");

        if (clausulas.incluirCustas90()) {
            sb.append("<p class=\"pedido\">Requer ainda, sejam dispensadas quaisquer custas ")
                    .append("processuais remanescentes, por força da redação do § 3º do artigo 90 do Código de ")
                    .append("Processo Civil;</p>");
        }

        if (clausulas.incluirArt922()) {
            sb.append("<p class=\"pedido\">Requer, por fim, seja determinado que os Autos aguardem ")
                    .append("em cartório o cumprimento do acordo, nos termos do artigo 922 do Código de Processo ")
                    .append("Civil, sendo que ao final, as partes de comprometem a manifestar quanto ao ")
                    .append("cumprimento da avença.</p>");
        }

        return sb.toString();
    }

    static String montarListaTitulos(List<TituloLinha> titulos) {
        if (titulos == null || titulos.isEmpty()) {
            return "";
        }
        List<String> partes = new ArrayList<>();
        for (TituloLinha t : titulos) {
            if (t == null) {
                continue;
            }
            String venc = nz(t.vencimento()).trim();
            BigDecimal valor = nz(t.valor());
            if (venc.isEmpty() || valor.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            partes.add("<span class=\"data-unica\">" + esc(venc) + "</span> no valor de " + formatBRL(valor));
        }
        return juntarComPontoVirgula(partes);
    }

    static String montarListaBoletos(List<BoletoLinha> boletos) {
        List<String> partes = new ArrayList<>();
        int n = 1;
        for (BoletoLinha b : boletos) {
            if (b == null || b.valor() == null || b.valor().compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            String venc = nz(b.vencimento()).trim();
            String extenso = ValorExtensoUtil.reaisPorExtenso(b.valor());
            partes.add(n + "º boleto no valor de " + formatBRL(b.valor()) + " (" + esc(extenso) + ")"
                    + (venc.isEmpty() ? "" : ", com vencimento em <span class=\"data-unica\">" + esc(venc) + "</span>"));
            n++;
        }
        return juntarComPontoVirgula(partes);
    }

    static String formatarQuantidadeParcelas(int qtd) {
        String numFmt = String.format("%02d", Math.max(1, qtd));
        String ext = femininoCardinal(qtd);
        String rotulo = qtd == 1 ? "parcela" : "parcelas";
        return numFmt + " (" + ext + ") " + rotulo;
    }

    private static String femininoCardinal(int n) {
        if (n == 1) {
            return "uma";
        }
        if (n == 2) {
            return "duas";
        }
        return ValorExtensoUtil.numeroPorExtenso(n);
    }

    private static String percentualComExtenso(BigDecimal pct) {
        BigDecimal v = nz(pct);
        int inteiro = v.setScale(0, java.math.RoundingMode.HALF_UP).intValue();
        String num = inteiro + "%";
        String ext = ValorExtensoUtil.numeroPorExtenso(inteiro) + " por cento";
        return esc(num) + " (" + esc(ext) + ")";
    }

    private static String valorComExtenso(BigDecimal valor, String extensoInformado) {
        String ext = nz(extensoInformado).trim();
        if (ext.isEmpty()) {
            ext = ValorExtensoUtil.reaisPorExtenso(valor);
        }
        return "<span class=\"valor-monetario\"><span class=\"valor-monetario-num\">"
                + esc(formatBRL(valor))
                + "</span> (" + esc(ext) + ")</span>";
    }

    private static String juntarComPontoVirgula(List<String> partes) {
        if (partes.isEmpty()) {
            return "";
        }
        if (partes.size() == 1) {
            return partes.get(0);
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < partes.size(); i++) {
            if (i > 0) {
                sb.append(i == partes.size() - 1 ? "; " : "; ");
            }
            sb.append(partes.get(i));
        }
        return sb.toString();
    }

    static String formatBRL(BigDecimal valor) {
        BigDecimal v = nz(valor);
        return "R$ " + DF_BRL.format(v);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private static String nz(String s) {
        return s != null ? s : "";
    }

    private static String esc(String texto) {
        if (texto == null) {
            return "";
        }
        return texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
