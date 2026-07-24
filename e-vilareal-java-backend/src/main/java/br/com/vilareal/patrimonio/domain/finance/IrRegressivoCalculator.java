package br.com.vilareal.patrimonio.domain.finance;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Tabela regressiva de IR sobre rendimento de renda fixa (pessoa física).
 * Horizonte em dias corridos — o mesmo horizonte deve ser usado nos dois lados da comparação.
 */
public final class IrRegressivoCalculator {

    private IrRegressivoCalculator() {
    }

    /** Alíquota decimal (ex.: 0.225 = 22,5%). */
    public static BigDecimal aliquota(int diasCorridos) {
        if (diasCorridos <= 180) {
            return new BigDecimal("0.225");
        }
        if (diasCorridos <= 360) {
            return new BigDecimal("0.20");
        }
        if (diasCorridos <= 720) {
            return new BigDecimal("0.175");
        }
        return new BigDecimal("0.15");
    }

    /**
     * Converte rentabilidade bruta % a.a. em líquida % a.a. aplicando IR regressivo
     * sobre o ganho, para o horizonte informado (em dias).
     */
    public static BigDecimal liquidoDeBrutoPercentAa(BigDecimal brutoPercentAa, int horizonteDias) {
        if (brutoPercentAa == null) {
            return BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
        }
        BigDecimal aliq = aliquota(Math.max(horizonteDias, 1));
        BigDecimal fator = BigDecimal.ONE.subtract(aliq, MoneyMath.MC);
        return brutoPercentAa.multiply(fator, MoneyMath.MC).setScale(4, RoundingMode.HALF_UP);
    }

    /** Converte prazo em meses para dias corridos aproximados (mês = 30 dias). */
    public static int mesesParaDias(int meses) {
        return Math.max(meses, 0) * 30;
    }
}
