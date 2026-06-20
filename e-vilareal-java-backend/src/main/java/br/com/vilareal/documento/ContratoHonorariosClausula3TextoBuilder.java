package br.com.vilareal.documento;

import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/** Monta o texto da Cláusula 3ª a partir de dados estruturados (com valores por extenso). */
public final class ContratoHonorariosClausula3TextoBuilder {

    public static final String TIPO_PERCENTUAL_PROVEITO = "PERCENTUAL_PROVEITO";
    public static final String TIPO_VALOR_FIXO = "VALOR_FIXO";
    public static final String TIPO_MISTO = "MISTO";

    public static final String FORMA_PAGAMENTO_PIX = "PIX";
    public static final String FORMA_PAGAMENTO_BOLETO = "BOLETO";
    /** CNPJ do escritório para recebimento via PIX nos honorários contratuais. */
    public static final String PIX_CNPJ_ESCRITORIO = "39.720.563/0001-90";

    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");
    private static final DateTimeFormatter FMT_DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private ContratoHonorariosClausula3TextoBuilder() {}

    public static String montarTexto(ContratoHonorariosClausula3Dados dados) {
        return montarTexto(dados, ContratoContratanteFlexao.padrao());
    }

    public static String montarTexto(ContratoHonorariosClausula3Dados dados, ContratoContratanteFlexao flexaoContratante) {
        if (dados == null) {
            return ContratoHonorariosClausulas.CLAUSULA_3_PADRAO;
        }
        ContratoContratanteFlexao flexao =
                flexaoContratante != null ? flexaoContratante : ContratoContratanteFlexao.padrao();
        String tipo = normalizarTipo(dados.tipoRemuneracao());
        return switch (tipo) {
            case TIPO_VALOR_FIXO -> montarValorFixo(dados, flexao);
            case TIPO_MISTO -> montarMisto(dados, flexao);
            default -> montarPercentualProveito(dados, flexao);
        };
    }

    public static List<ParcelaCalculada> calcularParcelas(ContratoHonorariosClausula3Dados dados) {
        if (dados == null || !parcelamentoAtivo(dados)) {
            return List.of();
        }
        if (dados.parcelas() != null && !dados.parcelas().isEmpty()) {
            return dados.parcelas().stream()
                    .filter(Objects::nonNull)
                    .filter(p -> p.valor() != null && p.dataVencimento() != null)
                    .sorted(Comparator.comparing(
                            p -> p.numero() != null ? p.numero() : Integer.MAX_VALUE))
                    .map(p -> new ParcelaCalculada(
                            p.numero() != null && p.numero() > 0 ? p.numero() : 1,
                            p.valor().setScale(2, RoundingMode.HALF_UP),
                            p.dataVencimento()))
                    .toList();
        }
        BigDecimal total = resolverValorTotalParcelas(dados);
        if (total == null || total.compareTo(BigDecimal.ZERO) <= 0) {
            return List.of();
        }
        int quantidade = dados.quantidadeParcelas() != null && dados.quantidadeParcelas() > 0
                ? dados.quantidadeParcelas()
                : 1;
        LocalDate primeiro = dados.primeiroVencimento() != null ? dados.primeiroVencimento() : LocalDate.now();
        boolean unica = "UNICA".equalsIgnoreCase(StringUtils.trimWhitespace(dados.intervaloParcelas()))
                || quantidade == 1;

        total = total.setScale(2, RoundingMode.HALF_UP);
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

    static boolean parcelamentoAtivo(ContratoHonorariosClausula3Dados dados) {
        if (Boolean.TRUE.equals(dados.temParcelamento())) {
            return true;
        }
        // Compatibilidade: parcelamento ligado só ao financeiro (versão anterior).
        return Boolean.TRUE.equals(dados.gerarRecebiveis());
    }

    static BigDecimal resolverValorTotalParcelas(ContratoHonorariosClausula3Dados dados) {
        if (dados.valorTotalParcelas() != null && dados.valorTotalParcelas().compareTo(BigDecimal.ZERO) > 0) {
            return dados.valorTotalParcelas();
        }
        if (dados.valorFixo() != null && dados.valorFixo().compareTo(BigDecimal.ZERO) > 0) {
            return dados.valorFixo();
        }
        return null;
    }

    private static String montarPercentualProveito(ContratoHonorariosClausula3Dados dados, ContratoContratanteFlexao flexao) {
        BigDecimal pct = dados.percentualProveito() != null ? dados.percentualProveito() : new BigDecimal("35");
        String pctFmt = formatarPercentual(pct);
        String pctExt = percentualPorExtenso(pct);
        StringBuilder sb = new StringBuilder();
        appendIntroRemuneracao(sb, flexao);
        sb.append(pctFmt)
                .append(" (")
                .append(pctExt)
                .append(") calculados sobre o montante proveito econômico da demanda (inclusive extrajudicial);");
        appendTextoParcelamento(sb, dados);
        appendTextoFormaPagamento(sb, dados);
        return sb.toString();
    }

    private static String montarValorFixo(ContratoHonorariosClausula3Dados dados, ContratoContratanteFlexao flexao) {
        BigDecimal valor = dados.valorFixo() != null ? dados.valorFixo() : BigDecimal.ZERO;
        if (valor.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Informe o valor fixo dos honorários.");
        }
        StringBuilder sb = new StringBuilder();
        appendIntroRemuneracao(sb, flexao);
        sb.append(formatarMoeda(valor))
                .append(" (")
                .append(ValorExtensoUtil.reaisPorExtenso(valor))
                .append(");");
        appendTextoParcelamento(sb, dados);
        appendTextoFormaPagamento(sb, dados);
        return sb.toString();
    }

    private static String montarMisto(ContratoHonorariosClausula3Dados dados, ContratoContratanteFlexao flexao) {
        BigDecimal pct = dados.percentualProveito() != null ? dados.percentualProveito() : new BigDecimal("35");
        BigDecimal valor = dados.valorFixo() != null ? dados.valorFixo() : BigDecimal.ZERO;
        if (valor.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Informe o valor fixo complementar dos honorários.");
        }
        StringBuilder sb = new StringBuilder();
        sb.append("Em REMUNERAÇÃO desses serviços, o advogado Contratado ")
                .append(flexao.receberaDeContratante())
                .append(": ")
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
        appendTextoFormaPagamento(sb, dados);
        return sb.toString();
    }

    private static void appendIntroRemuneracao(StringBuilder sb, ContratoContratanteFlexao flexao) {
        sb.append("Em REMUNERAÇÃO desses serviços, o advogado Contratado ")
                .append(flexao.receberaDeContratante())
                .append(" os honorários líquidos e certos na importância de ");
    }

    private static void appendTextoParcelamento(StringBuilder sb, ContratoHonorariosClausula3Dados dados) {
        List<ParcelaCalculada> parcelas = calcularParcelas(dados);
        if (parcelas.isEmpty()) {
            return;
        }
        String sufixoForma = sufixoFormaPagamentoInline(dados);
        if (parcelas.size() == 1) {
            ParcelaCalculada p = parcelas.get(0);
            sb.append(" O pagamento será efetuado em parcela única de ")
                    .append(formatarMoeda(p.valor()))
                    .append(" (")
                    .append(ValorExtensoUtil.reaisPorExtenso(p.valor()))
                    .append("), com vencimento em ")
                    .append(FMT_DATA.format(p.dataVencimento()))
                    .append(sufixoForma)
                    .append(".");
            return;
        }
        boolean valoresUniformes = parcelas.stream().map(ParcelaCalculada::valor).distinct().count() <= 1;
        if (valoresUniformes) {
            ParcelaCalculada primeira = parcelas.get(0);
            sb.append(" O pagamento será efetuado em ")
                    .append(parcelas.size())
                    .append(" parcelas mensais de ")
                    .append(formatarMoeda(primeira.valor()))
                    .append(" (")
                    .append(ValorExtensoUtil.reaisPorExtenso(primeira.valor()))
                    .append("), vencendo a primeira em ")
                    .append(FMT_DATA.format(primeira.dataVencimento()))
                    .append(sufixoForma)
                    .append(".");
            return;
        }
        sb.append(" O pagamento será efetuado em ")
                .append(parcelas.size())
                .append(" parcelas, nos seguintes valores e vencimentos:");
        for (ParcelaCalculada p : parcelas) {
            sb.append(" ")
                    .append(p.numero())
                    .append("ª parcela de ")
                    .append(formatarMoeda(p.valor()))
                    .append(" (")
                    .append(ValorExtensoUtil.reaisPorExtenso(p.valor()))
                    .append("), vencimento em ")
                    .append(FMT_DATA.format(p.dataVencimento()))
                    .append(";");
        }
        sb.setLength(sb.length() - 1);
        sb.append(sufixoForma).append(".");
    }

    /** Frase de forma de pagamento quando não há parcelamento explícito. */
    private static void appendTextoFormaPagamento(StringBuilder sb, ContratoHonorariosClausula3Dados dados) {
        if (!calcularParcelas(dados).isEmpty()) {
            return;
        }
        String forma = normalizarFormaPagamento(dados.formaPagamento());
        String sufixoData = sufixoDataVencimento(dados.primeiroVencimento());
        if (FORMA_PAGAMENTO_PIX.equals(forma)) {
            sb.append(" O pagamento será efetuado via PIX, chave CNPJ ")
                    .append(PIX_CNPJ_ESCRITORIO)
                    .append(sufixoData)
                    .append(".");
        } else if (FORMA_PAGAMENTO_BOLETO.equals(forma)) {
            sb.append(" O pagamento será efetuado mediante boleto bancário emitido pelo Contratado")
                    .append(sufixoData)
                    .append(".");
        }
    }

    private static String sufixoDataVencimento(LocalDate data) {
        if (data == null) {
            return "";
        }
        return ", com vencimento em " + FMT_DATA.format(data);
    }

    private static String sufixoFormaPagamentoInline(ContratoHonorariosClausula3Dados dados) {
        String forma = normalizarFormaPagamento(dados.formaPagamento());
        if (FORMA_PAGAMENTO_PIX.equals(forma)) {
            return ", via PIX (chave CNPJ " + PIX_CNPJ_ESCRITORIO + ")";
        }
        if (FORMA_PAGAMENTO_BOLETO.equals(forma)) {
            return ", mediante boleto bancário emitido pelo Contratado";
        }
        return "";
    }

    private static String normalizarFormaPagamento(String forma) {
        if (!StringUtils.hasText(forma)) {
            return FORMA_PAGAMENTO_PIX;
        }
        return forma.trim().toUpperCase(Locale.ROOT);
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
