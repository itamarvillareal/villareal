package br.com.vilareal.documento.importacao.application;

import br.com.vilareal.documento.ContratoHonorariosClausula3Dados;
import br.com.vilareal.documento.ContratoHonorariosParcelaClausula3;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/** Gera parcelas históricas desde dataContrato para importação de contratos celebrados. */
public final class ContratoHonorariosImportacaoParcelasUtil {

    private ContratoHonorariosImportacaoParcelasUtil() {}

    /**
     * Ajusta dados para gerar todas as parcelas mensais desde {@code dataContrato} até o mês atual.
     * Se já houver parcelas explícitas na extração, mantém.
     */
    public static ContratoHonorariosClausula3Dados prepararDadosHistoricos(
            ContratoHonorariosClausula3Dados base, LocalDate dataContrato) {
        if (base == null || dataContrato == null) {
            return base;
        }
        if (base.parcelas() != null && !base.parcelas().isEmpty()) {
            return base;
        }
        String tipo = base.tipoRemuneracao() != null ? base.tipoRemuneracao().trim() : "";
        if ("PERCENTUAL_PROVEITO".equalsIgnoreCase(tipo)) {
            return base;
        }
        BigDecimal valorMensal = resolverValorMensal(base);
        if (valorMensal == null || valorMensal.compareTo(BigDecimal.ZERO) <= 0) {
            return base;
        }
        LocalDate primeiro = base.primeiroVencimento() != null ? base.primeiroVencimento() : dataContrato;
        int meses = calcularMesesDesde(primeiro, LocalDate.now());
        if (meses < 1) {
            meses = 1;
        }
        List<ContratoHonorariosParcelaClausula3> parcelas = new ArrayList<>(meses);
        for (int i = 0; i < meses; i++) {
            LocalDate venc = primeiro.plusMonths(i);
            parcelas.add(new ContratoHonorariosParcelaClausula3(i + 1, valorMensal, venc));
        }
        BigDecimal total = valorMensal.multiply(BigDecimal.valueOf(meses)).setScale(2, RoundingMode.HALF_UP);
        return new ContratoHonorariosClausula3Dados(
                base.tipoRemuneracao(),
                base.percentualProveito(),
                base.valorFixo(),
                true,
                true,
                meses,
                total,
                primeiro,
                base.intervaloParcelas() != null ? base.intervaloParcelas() : "MENSAL",
                base.formaPagamento(),
                parcelas);
    }

    static int calcularMesesDesde(LocalDate de, LocalDate ate) {
        if (de == null || ate == null) {
            return 1;
        }
        YearMonth inicio = YearMonth.from(de);
        YearMonth fim = YearMonth.from(ate);
        long diff = ChronoUnit.MONTHS.between(inicio, fim) + 1;
        return (int) Math.max(1, Math.min(diff, 600));
    }

    static BigDecimal resolverValorMensal(ContratoHonorariosClausula3Dados dados) {
        if (dados.valorFixo() != null && dados.valorFixo().compareTo(BigDecimal.ZERO) > 0) {
            return dados.valorFixo();
        }
        if (dados.valorTotalParcelas() != null
                && dados.quantidadeParcelas() != null
                && dados.quantidadeParcelas() > 0) {
            return dados.valorTotalParcelas()
                    .divide(BigDecimal.valueOf(dados.quantidadeParcelas()), 2, RoundingMode.HALF_UP);
        }
        return null;
    }
}
