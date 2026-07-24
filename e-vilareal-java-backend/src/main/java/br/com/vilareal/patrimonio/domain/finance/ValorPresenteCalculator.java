package br.com.vilareal.patrimonio.domain.finance;

import java.math.BigDecimal;
import java.util.List;

/**
 * Valor presente de fluxos futuros descontados à taxa mensal efetiva.
 */
public final class ValorPresenteCalculator {

    private ValorPresenteCalculator() {
    }

    /**
     * VP das parcelas restantes (valor total pago, incluindo seguros/taxas se presentes na parcela).
     * Período 1 = próximo vencimento.
     */
    public static BigDecimal valorPresenteParcelas(List<ParcelaCronograma> parcelas, BigDecimal taxaDescontoAnualDecimal) {
        if (parcelas == null || parcelas.isEmpty()) {
            return MoneyMath.ZERO;
        }
        BigDecimal taxaMensal = MoneyMath.taxaMensalDeAnual(taxaDescontoAnualDecimal);
        BigDecimal vp = BigDecimal.ZERO;
        for (int i = 0; i < parcelas.size(); i++) {
            ParcelaCronograma p = parcelas.get(i);
            BigDecimal fluxo = p.valorParcela().add(p.segurosTaxas() != null ? p.segurosTaxas() : BigDecimal.ZERO);
            BigDecimal fator = MoneyMath.discountFactor(taxaMensal, i + 1);
            vp = vp.add(fluxo.multiply(fator, MoneyMath.MC), MoneyMath.MC);
        }
        return MoneyMath.money(vp);
    }

    /** VP somente da componente de juros das parcelas. */
    public static BigDecimal valorPresenteJuros(List<ParcelaCronograma> parcelas, BigDecimal taxaDescontoAnualDecimal) {
        if (parcelas == null || parcelas.isEmpty()) {
            return MoneyMath.ZERO;
        }
        BigDecimal taxaMensal = MoneyMath.taxaMensalDeAnual(taxaDescontoAnualDecimal);
        BigDecimal vp = BigDecimal.ZERO;
        for (int i = 0; i < parcelas.size(); i++) {
            BigDecimal fator = MoneyMath.discountFactor(taxaMensal, i + 1);
            vp = vp.add(parcelas.get(i).juros().multiply(fator, MoneyMath.MC), MoneyMath.MC);
        }
        return MoneyMath.money(vp);
    }

    /**
     * Soma nominal das parcelas (o número "emocional" — nunca usar sozinho na decisão).
     */
    public static BigDecimal valorNominal(List<ParcelaCronograma> parcelas) {
        if (parcelas == null || parcelas.isEmpty()) {
            return MoneyMath.ZERO;
        }
        BigDecimal total = BigDecimal.ZERO;
        for (ParcelaCronograma p : parcelas) {
            total = total.add(p.valorParcela());
        }
        return MoneyMath.money(total);
    }
}
