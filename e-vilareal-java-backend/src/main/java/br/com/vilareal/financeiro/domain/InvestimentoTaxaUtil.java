package br.com.vilareal.financeiro.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class InvestimentoTaxaUtil {

    private InvestimentoTaxaUtil() {}

    /**
     * Taxa mensal equivalente composta: (VF/VI)^(30/d) - 1
     */
    public static BigDecimal taxaMensalLiquida(BigDecimal valorEntrada, BigDecimal valorCompra, int dias) {
        if (valorCompra == null || valorEntrada == null || dias <= 0) {
            return null;
        }
        if (valorCompra.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        double ratio = valorEntrada.divide(valorCompra, 12, RoundingMode.HALF_UP).doubleValue();
        if (ratio <= 0) {
            return null;
        }
        double taxa = Math.pow(ratio, 30.0 / dias) - 1.0;
        return BigDecimal.valueOf(taxa).setScale(8, RoundingMode.HALF_UP);
    }

    public static BigDecimal taxaAnualLiquida(BigDecimal valorEntrada, BigDecimal valorCompra, int dias) {
        if (valorCompra == null || valorEntrada == null || dias <= 0) {
            return null;
        }
        if (valorCompra.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        double ratio = valorEntrada.divide(valorCompra, 12, RoundingMode.HALF_UP).doubleValue();
        if (ratio <= 0) {
            return null;
        }
        double taxa = Math.pow(ratio, 365.0 / dias) - 1.0;
        return BigDecimal.valueOf(taxa).setScale(8, RoundingMode.HALF_UP);
    }
}
