package br.com.vilareal.patrimonio.domain.finance;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;

/**
 * Utilitários monetários e de taxa — precisão fixa para evitar deriva.
 */
public final class MoneyMath {

    public static final int MONEY_SCALE = 2;
    public static final int RATE_SCALE = 10;
    public static final MathContext MC = new MathContext(20, RoundingMode.HALF_UP);
    public static final BigDecimal ZERO = BigDecimal.ZERO.setScale(MONEY_SCALE, RoundingMode.HALF_UP);
    public static final BigDecimal HUNDRED = new BigDecimal("100");
    public static final BigDecimal TWELVE = new BigDecimal("12");

    private MoneyMath() {
    }

    public static BigDecimal money(BigDecimal value) {
        if (value == null) {
            return ZERO;
        }
        return value.setScale(MONEY_SCALE, RoundingMode.HALF_UP);
    }

    public static BigDecimal money(String value) {
        return money(new BigDecimal(value));
    }

    public static BigDecimal rate(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(RATE_SCALE, RoundingMode.HALF_UP);
        }
        return value.setScale(RATE_SCALE, RoundingMode.HALF_UP);
    }

    /** Taxa anual decimal → taxa mensal equivalente: (1+a)^(1/12)-1 */
    public static BigDecimal taxaMensalDeAnual(BigDecimal taxaAnualDecimal) {
        if (taxaAnualDecimal == null || taxaAnualDecimal.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO.setScale(RATE_SCALE, RoundingMode.HALF_UP);
        }
        double anual = taxaAnualDecimal.doubleValue();
        double mensal = Math.pow(1.0 + anual, 1.0 / 12.0) - 1.0;
        return rate(BigDecimal.valueOf(mensal));
    }

    /** Taxa mensal decimal → taxa anual efetiva: (1+m)^12-1 */
    public static BigDecimal taxaAnualDeMensal(BigDecimal taxaMensalDecimal) {
        if (taxaMensalDecimal == null || taxaMensalDecimal.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO.setScale(RATE_SCALE, RoundingMode.HALF_UP);
        }
        double mensal = taxaMensalDecimal.doubleValue();
        double anual = Math.pow(1.0 + mensal, 12.0) - 1.0;
        return rate(BigDecimal.valueOf(anual));
    }

    /** Percentual (ex. 13.0) → decimal (0.13). */
    public static BigDecimal percentToDecimal(BigDecimal percent) {
        if (percent == null) {
            return BigDecimal.ZERO;
        }
        return rate(percent.divide(HUNDRED, MC));
    }

    /** Decimal (0.13) → percentual (13.0) com 4 casas. */
    public static BigDecimal decimalToPercent(BigDecimal decimal) {
        if (decimal == null) {
            return BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
        }
        return decimal.multiply(HUNDRED, MC).setScale(4, RoundingMode.HALF_UP);
    }

    public static BigDecimal pow(BigDecimal base, int exp) {
        if (exp == 0) {
            return BigDecimal.ONE;
        }
        return base.pow(exp, MC);
    }

    /** Fator de desconto 1/(1+i)^n */
    public static BigDecimal discountFactor(BigDecimal taxaMensal, int periodos) {
        if (periodos <= 0) {
            return BigDecimal.ONE;
        }
        if (taxaMensal == null || taxaMensal.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ONE;
        }
        BigDecimal denom = BigDecimal.ONE.add(taxaMensal, MC).pow(periodos, MC);
        return BigDecimal.ONE.divide(denom, MC);
    }
}
