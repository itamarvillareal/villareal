package br.com.vilareal.patrimonio.domain.finance;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
import java.util.Set;

/**
 * Garante que CET da dívida e retorno da alternativa estão na mesma base
 * (nominal projetado) antes da comparação — falha mais comum do motor em pós-fixados.
 */
public final class BaseComparacaoTaxas {

    private static final Set<String> POS_FIXADOS = Set.of(
            "IPCA", "IPCA+", "TR", "INCC", "POUPANCA", "POUPANÇA", "CDI+");

    private BaseComparacaoTaxas() {
    }

    public record Resultado(
            BigDecimal cetProjetadoPercentAa,
            BigDecimal alternativaMesmaBasePercentAa,
            String base,
            String aviso
    ) {
    }

    /**
     * @param cetInformadoPercentAa CET já informado (pode incluir projeção)
     * @param indexadorDivida       IPCA, TR, PREFIXADO, etc.
     * @param alternativaLiquidaPercentAa retorno líquido da alternativa na base informada
     * @param indexadorAlternativa  tipicamente CDI / PREFIXADO
     * @param inflacaoProjetadaPercentAa IPCA projetado a.a. (para alinhar real→nominal)
     * @param cetJaProjetado        true se o CET já embute a projeção do indexador
     */
    public static Resultado alinhar(
            BigDecimal cetInformadoPercentAa,
            String indexadorDivida,
            BigDecimal alternativaLiquidaPercentAa,
            String indexadorAlternativa,
            BigDecimal inflacaoProjetadaPercentAa,
            boolean cetJaProjetado) {

        String idxDiv = norm(indexadorDivida);
        String idxAlt = norm(indexadorAlternativa);
        boolean dividaPos = isPosFixado(idxDiv);
        boolean altPos = isPosFixado(idxAlt);
        BigDecimal inflacao = inflacaoProjetadaPercentAa != null
                ? inflacaoProjetadaPercentAa : BigDecimal.ZERO;

        BigDecimal cet = cetInformadoPercentAa != null ? cetInformadoPercentAa : BigDecimal.ZERO;
        BigDecimal alt = alternativaLiquidaPercentAa != null ? alternativaLiquidaPercentAa : BigDecimal.ZERO;

        // Ambos prefixados / mesma natureza → base NOMINAL
        if (!dividaPos && !altPos) {
            return new Resultado(cet, alt, "NOMINAL", null);
        }

        // Dívida pós-fixada: CET deve estar projetado (nominal). Se vier só o spread real, soma inflação.
        BigDecimal cetProj = cet;
        String aviso = null;
        if (dividaPos && !cetJaProjetado && inflacao.compareTo(BigDecimal.ZERO) > 0) {
            // Aproximação Fisher: (1+r)*(1+i)-1
            BigDecimal r = MoneyMath.percentToDecimal(cet);
            BigDecimal i = MoneyMath.percentToDecimal(inflacao);
            BigDecimal nom = BigDecimal.ONE.add(r, MoneyMath.MC).multiply(BigDecimal.ONE.add(i, MoneyMath.MC), MoneyMath.MC)
                    .subtract(BigDecimal.ONE, MoneyMath.MC);
            cetProj = MoneyMath.decimalToPercent(nom);
            aviso = "CET da dívida pós-fixada projetado para base nominal com inflação "
                    + inflacao.setScale(2, RoundingMode.HALF_UP) + "% a.a.";
        } else if (dividaPos && cetJaProjetado) {
            aviso = "CET informado já em base nominal projetada; alternativa alinhada à mesma base.";
        }

        // Alternativa em CDI/nominal já está em nominal — OK.
        // Se alternativa estiver em "real" (raro), projetar também.
        BigDecimal altMesma = alt;
        if ("REAL".equals(idxAlt) && inflacao.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal r = MoneyMath.percentToDecimal(alt);
            BigDecimal i = MoneyMath.percentToDecimal(inflacao);
            BigDecimal nom = BigDecimal.ONE.add(r, MoneyMath.MC).multiply(BigDecimal.ONE.add(i, MoneyMath.MC), MoneyMath.MC)
                    .subtract(BigDecimal.ONE, MoneyMath.MC);
            altMesma = MoneyMath.decimalToPercent(nom);
        }

        return new Resultado(cetProj, altMesma, "NOMINAL_PROJETADO", aviso);
    }

    public static boolean isPosFixado(String indexador) {
        String n = norm(indexador);
        if (n.isEmpty() || n.equals("PREFIXADO") || n.equals("PRE") || n.equals("CDI")) {
            return false;
        }
        return POS_FIXADOS.contains(n) || n.startsWith("IPCA") || n.startsWith("TR") || n.startsWith("INCC");
    }

    private static String norm(String s) {
        return s == null ? "" : s.trim().toUpperCase(Locale.ROOT);
    }
}
