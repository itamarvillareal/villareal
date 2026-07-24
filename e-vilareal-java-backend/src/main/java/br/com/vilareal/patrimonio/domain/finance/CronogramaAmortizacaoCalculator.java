package br.com.vilareal.patrimonio.domain.finance;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Gera cronogramas SAC e Price. Consórcio NÃO usa esta classe.
 */
public final class CronogramaAmortizacaoCalculator {

    private CronogramaAmortizacaoCalculator() {
    }

    public static List<ParcelaCronograma> gerar(
            SistemaAmortizacao sistema,
            BigDecimal saldoInicial,
            BigDecimal taxaJurosAnualDecimal,
            int prazoMeses,
            LocalDate primeiroVencimento,
            BigDecimal segurosTaxasMensais) {
        if (sistema == SistemaAmortizacao.CONSORCIO) {
            throw new IllegalArgumentException("Consórcio não usa cronograma SAC/Price");
        }
        if (prazoMeses <= 0) {
            return List.of();
        }
        BigDecimal taxaMensal = MoneyMath.taxaMensalDeAnual(taxaJurosAnualDecimal);
        BigDecimal seguros = MoneyMath.money(segurosTaxasMensais);
        return switch (sistema) {
            case SAC -> gerarSac(saldoInicial, taxaMensal, prazoMeses, primeiroVencimento, seguros);
            case PRICE -> gerarPrice(saldoInicial, taxaMensal, prazoMeses, primeiroVencimento, seguros);
            case CONSORCIO -> throw new IllegalStateException("unreachable");
        };
    }

    static List<ParcelaCronograma> gerarSac(
            BigDecimal saldoInicial,
            BigDecimal taxaMensal,
            int n,
            LocalDate primeiroVencimento,
            BigDecimal seguros) {
        List<ParcelaCronograma> out = new ArrayList<>(n);
        BigDecimal saldo = MoneyMath.money(saldoInicial);
        BigDecimal amortizacaoFixa = saldo.divide(BigDecimal.valueOf(n), MoneyMath.MONEY_SCALE, RoundingMode.HALF_UP);
        for (int i = 1; i <= n; i++) {
            BigDecimal juros = MoneyMath.money(saldo.multiply(taxaMensal, MoneyMath.MC));
            BigDecimal amort = (i == n) ? saldo : amortizacaoFixa;
            BigDecimal parcela = MoneyMath.money(amort.add(juros));
            saldo = MoneyMath.money(saldo.subtract(amort));
            if (saldo.compareTo(BigDecimal.ZERO) < 0) {
                saldo = MoneyMath.ZERO;
            }
            out.add(new ParcelaCronograma(
                    i,
                    primeiroVencimento.plusMonths(i - 1L),
                    parcela,
                    amort,
                    juros,
                    seguros,
                    saldo));
        }
        return out;
    }

    static List<ParcelaCronograma> gerarPrice(
            BigDecimal saldoInicial,
            BigDecimal taxaMensal,
            int n,
            LocalDate primeiroVencimento,
            BigDecimal seguros) {
        List<ParcelaCronograma> out = new ArrayList<>(n);
        BigDecimal saldo = MoneyMath.money(saldoInicial);
        BigDecimal pmt = parcelaPrice(saldo, taxaMensal, n);
        for (int i = 1; i <= n; i++) {
            BigDecimal juros = MoneyMath.money(saldo.multiply(taxaMensal, MoneyMath.MC));
            BigDecimal amort = MoneyMath.money(pmt.subtract(juros));
            if (i == n) {
                amort = saldo;
                pmt = MoneyMath.money(amort.add(juros));
            }
            saldo = MoneyMath.money(saldo.subtract(amort));
            if (saldo.compareTo(BigDecimal.ZERO) < 0) {
                saldo = MoneyMath.ZERO;
            }
            out.add(new ParcelaCronograma(
                    i,
                    primeiroVencimento.plusMonths(i - 1L),
                    pmt,
                    amort,
                    juros,
                    seguros,
                    saldo));
        }
        return out;
    }

    /** PMT = PV * i / (1 - (1+i)^-n) */
    public static BigDecimal parcelaPrice(BigDecimal pv, BigDecimal taxaMensal, int n) {
        if (n <= 0) {
            return MoneyMath.ZERO;
        }
        if (taxaMensal.compareTo(BigDecimal.ZERO) == 0) {
            return MoneyMath.money(pv.divide(BigDecimal.valueOf(n), MoneyMath.MC));
        }
        BigDecimal umMaisI = BigDecimal.ONE.add(taxaMensal, MoneyMath.MC);
        // denom = 1 - (1+i)^-n
        BigDecimal denom = BigDecimal.ONE.subtract(
                BigDecimal.ONE.divide(MoneyMath.pow(umMaisI, n), MoneyMath.MC), MoneyMath.MC);
        if (denom.compareTo(BigDecimal.ZERO) == 0) {
            return MoneyMath.money(pv.divide(BigDecimal.valueOf(n), MoneyMath.MC));
        }
        return MoneyMath.money(pv.multiply(taxaMensal, MoneyMath.MC).divide(denom, MoneyMath.MC));
    }
}
