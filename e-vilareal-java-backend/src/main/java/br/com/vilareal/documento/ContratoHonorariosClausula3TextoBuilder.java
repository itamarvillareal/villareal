package br.com.vilareal.documento;

import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Monta o texto da Cláusula 3ª a partir de dados estruturados (com valores por extenso). */
public final class ContratoHonorariosClausula3TextoBuilder {

    public static final String TIPO_PERCENTUAL_PROVEITO = "PERCENTUAL_PROVEITO";
    public static final String TIPO_VALOR_FIXO = "VALOR_FIXO";
    public static final String TIPO_MISTO = "MISTO";

    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");
    private static final DateTimeFormatter FMT_DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private ContratoHonorariosClausula3TextoBuilder() {}

    public static String montarTexto(ContratoHonorariosClausula3Dados dados) {
        if (dados == null) {
            return ContratoHonorariosClausulas.CLAUSULA_3_PADRAO;
        }
        String tipo = normalizarTipo(dados.tipoRemuneracao());
        return switch (tipo) {
            case TIPO_VALOR_FIXO -> montarValorFixo(dados);
            case TIPO_MISTO -> montarMisto(dados);
            default -> montarPercentualProveito(dados);
        };
    }

    public static List<ParcelaCalculada> calcularParcelas(ContratoHonorariosClausula3Dados dados) {
        if (dados == null
                || !Boolean.TRUE.equals(dados.gerarRecebiveis())
                || dados.valorTotalParcelas() == null
                || dados.valorTotalParcelas().compareTo(BigDecimal.ZERO) <= 0) {
            return List.of();
        }
        int quantidade = dados.quantidadeParcelas() != null && dados.quantidadeParcelas() > 0
                ? dados.quantidadeParcelas()
                : 1;
        LocalDate primeiro = dados.primeiroVencimento() != null ? dados.primeiroVencimento() : LocalDate.now();
        boolean unica = "UNICA".equalsIgnoreCase(StringUtils.trimWhitespace(dados.intervaloParcelas()))
                || quantidade == 1;

        BigDecimal total = dados.valorTotalParcelas().setScale(2, RoundingMode.HALF_UP);
        BigDecimal base = total.divide(BigDecimal.valueOf(quantidade), 2, RoundingMode.DOWN);
        BigDecimal acumulado = BigDecimal.ZERO;

        List<ParcelaCalculada> parcelas = new ArrayList<>(quantidade);
        for (int i = 1; i <= quantidade; i++) {
            BigDecimal valor = i < quantidade ? base : total.subtract(acumulado);
            acumulado = acumulado.add(valor);
            LocalDate vencimento = unica ? primeiro : primeiro.plusMonths(i - 1L);
            parcelas.add(new ParcelaCalculada(i, valor, vencimento));
        }
        return parcelas;
    }

    private static String montarPercentualProveito(ContratoHonorariosClausula3Dados dados) {
        BigDecimal pct = dados.percentualProveito() != null ? dados.percentualProveito() : new BigDecimal("35");
        String pctFmt = formatarPercentual(pct);
        String pctExt = percentualPorExtenso(pct);
        StringBuilder sb = new StringBuilder();
        sb.append("Em REMUNERAÇÃO desses serviços, o advogado Contratado receberá da Contratante os ")
                .append("honorários líquidos e certos na importância de ")
                .append(pctFmt)
                .append(" (")
                .append(pctExt)
                .append(") calculados sobre o montante proveito econômico da demanda (inclusive extrajudicial);");
        appendTextoParcelamento(sb, dados);
        return sb.toString();
    }

    private static String montarValorFixo(ContratoHonorariosClausula3Dados dados) {
        BigDecimal valor = dados.valorFixo() != null ? dados.valorFixo() : BigDecimal.ZERO;
        if (valor.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Informe o valor fixo dos honorários.");
        }
        StringBuilder sb = new StringBuilder();
        sb.append("Em REMUNERAÇÃO desses serviços, o advogado Contratado receberá da Contratante os ")
                .append("honorários líquidos e certos na importância de ")
                .append(formatarMoeda(valor))
                .append(" (")
                .append(ValorExtensoUtil.reaisPorExtenso(valor))
                .append(");");
        appendTextoParcelamento(sb, dados);
        return sb.toString();
    }

    private static String montarMisto(ContratoHonorariosClausula3Dados dados) {
        BigDecimal pct = dados.percentualProveito() != null ? dados.percentualProveito() : new BigDecimal("35");
        BigDecimal valor = dados.valorFixo() != null ? dados.valorFixo() : BigDecimal.ZERO;
        if (valor.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Informe o valor fixo complementar dos honorários.");
        }
        StringBuilder sb = new StringBuilder();
        sb.append("Em REMUNERAÇÃO desses serviços, o advogado Contratado receberá da Contratante: ")
                .append("(a) honorários líquidos e certos na importância de ")
                .append(formatarPercentual(pct))
                .append(" (")
                .append(percentualPorExtenso(pct))
                .append(") calculados sobre o montante proveito econômico da demanda (inclusive extrajudicial); ")
                .append("e (b) valor fixo de ")
                .append(formatarMoeda(valor))
                .append(" (")
                .append(ValorExtensoUtil.reaisPorExtenso(valor))
                .append(");");
        appendTextoParcelamento(sb, dados);
        return sb.toString();
    }

    private static void appendTextoParcelamento(StringBuilder sb, ContratoHonorariosClausula3Dados dados) {
        List<ParcelaCalculada> parcelas = calcularParcelas(dados);
        if (parcelas.isEmpty()) {
            return;
        }
        if (parcelas.size() == 1) {
            ParcelaCalculada p = parcelas.get(0);
            sb.append(" O pagamento será efetuado em parcela única de ")
                    .append(formatarMoeda(p.valor()))
                    .append(" (")
                    .append(ValorExtensoUtil.reaisPorExtenso(p.valor()))
                    .append("), com vencimento em ")
                    .append(FMT_DATA.format(p.dataVencimento()))
                    .append(".");
            return;
        }
        ParcelaCalculada primeira = parcelas.get(0);
        sb.append(" O pagamento será efetuado em ")
                .append(parcelas.size())
                .append(" parcelas mensais de ")
                .append(formatarMoeda(primeira.valor()))
                .append(" (")
                .append(ValorExtensoUtil.reaisPorExtenso(primeira.valor()))
                .append("), vencendo a primeira em ")
                .append(FMT_DATA.format(primeira.dataVencimento()))
                .append(".");
    }

    static String percentualPorExtenso(BigDecimal percentual) {
        BigDecimal v = (percentual == null ? BigDecimal.ZERO : percentual).setScale(2, RoundingMode.HALF_UP);
        long inteiro = v.longValue();
        int centesimos = v.remainder(BigDecimal.ONE).movePointRight(2).abs().intValue();
        if (centesimos == 0) {
            return ValorExtensoUtil.numeroPorExtenso(inteiro) + " por cento";
        }
        return ValorExtensoUtil.numeroPorExtenso(inteiro)
                + " vírgula "
                + ValorExtensoUtil.numeroPorExtenso(centesimos)
                + " por cento";
    }

    private static String formatarPercentual(BigDecimal pct) {
        NumberFormat nf = NumberFormat.getNumberInstance(PT_BR);
        nf.setMinimumFractionDigits(0);
        nf.setMaximumFractionDigits(2);
        return nf.format(pct) + "%";
    }

    private static String formatarMoeda(BigDecimal valor) {
        NumberFormat nf = NumberFormat.getCurrencyInstance(PT_BR);
        return nf.format(valor);
    }

    private static String normalizarTipo(String tipo) {
        if (!StringUtils.hasText(tipo)) {
            return TIPO_PERCENTUAL_PROVEITO;
        }
        return tipo.trim().toUpperCase(Locale.ROOT);
    }

    public record ParcelaCalculada(int numero, BigDecimal valor, LocalDate dataVencimento) {}
}
