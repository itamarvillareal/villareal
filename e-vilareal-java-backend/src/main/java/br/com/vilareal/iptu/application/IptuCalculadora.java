package br.com.vilareal.iptu.application;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/** Pure IPTU calculator for the lease overlap within the calendar year. No Spring/JPA. */
public final class IptuCalculadora {

    private static final MathContext MC = MathContext.DECIMAL64;

    private IptuCalculadora() {}

    public record ParcelaCalculada(YearMonth competencia, int diasCobrados, boolean mesCompleto, BigDecimal valor) {}

    public record ResultadoCalculo(
            BigDecimal valorMensal, BigDecimal valorDiario, BigDecimal totalDevido, List<ParcelaCalculada> parcelas) {}

    /**
     * @param valorAnual annual IPTU amount
     * @param anoReferencia calendar year (Jan-Dec)
     * @param dataInicioContrato contract start (required)
     * @param dataFimContrato contract end; {@code null} means open-ended (use 31 Dec of the year in the overlap)
     * @param diasMesDivisor fixed divisor for daily rate (e.g. 30)
     */
    public static ResultadoCalculo calcular(
            BigDecimal valorAnual,
            int anoReferencia,
            LocalDate dataInicioContrato,
            LocalDate dataFimContrato,
            int diasMesDivisor) {
        if (valorAnual == null || valorAnual.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("valorAnual invalid");
        }
        if (diasMesDivisor <= 0) {
            throw new IllegalArgumentException("diasMesDivisor must be > 0");
        }
        LocalDate yearStart = LocalDate.of(anoReferencia, 1, 1);
        LocalDate yearEnd = LocalDate.of(anoReferencia, 12, 31);
        LocalDate contratoFimEfetivo = dataFimContrato != null ? dataFimContrato : yearEnd;
        LocalDate inicioPeriodo = dataInicioContrato.isAfter(yearStart) ? dataInicioContrato : yearStart;
        LocalDate fimPeriodo = contratoFimEfetivo.isBefore(yearEnd) ? contratoFimEfetivo : yearEnd;
        if (inicioPeriodo.isAfter(fimPeriodo)) {
            return new ResultadoCalculo(
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_EVEN),
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_EVEN),
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_EVEN),
                    List.of());
        }

        BigDecimal valorMensalBruto = valorAnual.divide(BigDecimal.valueOf(12), MC);
        BigDecimal valorDiarioBruto =
                valorMensalBruto.divide(BigDecimal.valueOf(diasMesDivisor), MC);

        List<ParcelaCalculada> parcelas = new ArrayList<>();
        for (int m = 1; m <= 12; m++) {
            YearMonth ym = YearMonth.of(anoReferencia, m);
            LocalDate inicioMes = ym.atDay(1);
            LocalDate fimMes = ym.atEndOfMonth();
            LocalDate segIni = inicioMes.isBefore(inicioPeriodo) ? inicioPeriodo : inicioMes;
            LocalDate segFim = fimMes.isAfter(fimPeriodo) ? fimPeriodo : fimMes;
            if (segIni.isAfter(segFim)) {
                continue;
            }
            boolean mesCompleto = segIni.equals(inicioMes) && segFim.equals(fimMes);
            int dias = (int) ChronoUnit.DAYS.between(segIni, segFim) + 1;
            BigDecimal valorParcela;
            if (mesCompleto) {
                valorParcela = valorMensalBruto.setScale(2, RoundingMode.HALF_EVEN);
            } else {
                valorParcela =
                        valorDiarioBruto.multiply(BigDecimal.valueOf(dias), MC).setScale(2, RoundingMode.HALF_EVEN);
            }
            parcelas.add(new ParcelaCalculada(ym, dias, mesCompleto, valorParcela));
        }
        BigDecimal total = parcelas.stream()
                .map(ParcelaCalculada::valor)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_EVEN);
        return new ResultadoCalculo(
                valorMensalBruto.setScale(2, RoundingMode.HALF_EVEN),
                valorDiarioBruto.setScale(2, RoundingMode.HALF_EVEN),
                total,
                parcelas);
    }
}
