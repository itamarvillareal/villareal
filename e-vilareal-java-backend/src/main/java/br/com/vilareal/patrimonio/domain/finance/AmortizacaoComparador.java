package br.com.vilareal.patrimonio.domain.finance;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Coração do sistema: compara amortizar dívida vs. manter investido.
 * Regra crítica: nunca reportar "meses eliminados" sem VP e taxa implícita.
 */
public final class AmortizacaoComparador {

    private static final BigDecimal BANDA_INDIFERENCA_PP = new BigDecimal("0.30");

    private AmortizacaoComparador() {
    }

    public record Entrada(
            SistemaAmortizacao sistema,
            BigDecimal saldoDevedor,
            BigDecimal cetEfetivoAaPercent,
            BigDecimal taxaJurosNominalAaPercent,
            int prazoRemanescenteMeses,
            BigDecimal parcelaAtual,
            BigDecimal segurosTaxasMensais,
            LocalDate proximoVencimento,
            BigDecimal valorAmortizar,
            BigDecimal retornoAlternativaLiquidaAaPercent,
            AmortizacaoComparacao.ModalidadeAmortizacao modalidade,
            boolean consorcioContemplado,
            BigDecimal caixaLivreDisponivel,
            BigDecimal reservaAposOperacao,
            BigDecimal pisoReserva,
            String indexadorDivida,
            String indexadorAlternativa,
            BigDecimal inflacaoProjetadaPercentAa,
            boolean cetJaProjetado,
            BigDecimal retornoAlternativaBrutaAaPercent,
            Integer horizonteComparacaoDias
    ) {
        /** Construtor de compatibilidade com testes legados. */
        public Entrada(
                SistemaAmortizacao sistema,
                BigDecimal saldoDevedor,
                BigDecimal cetEfetivoAaPercent,
                BigDecimal taxaJurosNominalAaPercent,
                int prazoRemanescenteMeses,
                BigDecimal parcelaAtual,
                BigDecimal segurosTaxasMensais,
                LocalDate proximoVencimento,
                BigDecimal valorAmortizar,
                BigDecimal retornoAlternativaLiquidaAaPercent,
                AmortizacaoComparacao.ModalidadeAmortizacao modalidade,
                boolean consorcioContemplado,
                BigDecimal caixaLivreDisponivel,
                BigDecimal reservaAposOperacao,
                BigDecimal pisoReserva) {
            this(sistema, saldoDevedor, cetEfetivoAaPercent, taxaJurosNominalAaPercent,
                    prazoRemanescenteMeses, parcelaAtual, segurosTaxasMensais, proximoVencimento,
                    valorAmortizar, retornoAlternativaLiquidaAaPercent, modalidade, consorcioContemplado,
                    caixaLivreDisponivel, reservaAposOperacao, pisoReserva,
                    "PREFIXADO", "CDI", null, true, null, null);
        }
    }

    public static AmortizacaoComparacao comparar(Entrada e) {
        int horizonteDias = e.horizonteComparacaoDias() != null
                ? e.horizonteComparacaoDias()
                : IrRegressivoCalculator.mesesParaDias(e.prazoRemanescenteMeses());

        BigDecimal altLiquida = e.retornoAlternativaLiquidaAaPercent();
        BigDecimal aliquotaIr = null;
        if (e.retornoAlternativaBrutaAaPercent() != null) {
            aliquotaIr = IrRegressivoCalculator.aliquota(horizonteDias);
            altLiquida = IrRegressivoCalculator.liquidoDeBrutoPercentAa(
                    e.retornoAlternativaBrutaAaPercent(), horizonteDias);
        }

        BaseComparacaoTaxas.Resultado bases = BaseComparacaoTaxas.alinhar(
                e.cetEfetivoAaPercent(),
                e.indexadorDivida(),
                altLiquida,
                e.indexadorAlternativa(),
                e.inflacaoProjetadaPercentAa(),
                e.cetJaProjetado());

        Entrada alinhada = new Entrada(
                e.sistema(), e.saldoDevedor(), bases.cetProjetadoPercentAa(),
                e.taxaJurosNominalAaPercent(), e.prazoRemanescenteMeses(), e.parcelaAtual(),
                e.segurosTaxasMensais(), e.proximoVencimento(), e.valorAmortizar(),
                bases.alternativaMesmaBasePercentAa(), e.modalidade(), e.consorcioContemplado(),
                e.caixaLivreDisponivel(), e.reservaAposOperacao(), e.pisoReserva(),
                e.indexadorDivida(), e.indexadorAlternativa(), e.inflacaoProjetadaPercentAa(),
                true, null, horizonteDias);

        if (alinhada.sistema() == SistemaAmortizacao.CONSORCIO && !alinhada.consorcioContemplado()) {
            return ConsorcioModelo.analisarAntecipacaoNaoContemplado(alinhada, bases, horizonteDias, aliquotaIr);
        }

        BigDecimal cet = MoneyMath.percentToDecimal(alinhada.cetEfetivoAaPercent());
        BigDecimal alt = MoneyMath.percentToDecimal(alinhada.retornoAlternativaLiquidaAaPercent());
        BigDecimal diferencialPp = MoneyMath.decimalToPercent(cet.subtract(alt, MoneyMath.MC));

        if (alinhada.caixaLivreDisponivel() != null
                && alinhada.valorAmortizar().compareTo(alinhada.caixaLivreDisponivel()) > 0) {
            return baseBloqueio(alinhada, diferencialPp,
                    RecomendacaoAmortizacao.BLOQUEADO_LIQUIDEZ,
                    "Caixa livre insuficiente. Capital vinculado (ex.: margem de puts) não pode ser usado. "
                            + "Disponível real: R$ " + MoneyMath.money(alinhada.caixaLivreDisponivel()).toPlainString() + ".",
                    bases, horizonteDias, aliquotaIr);
        }
        if (alinhada.pisoReserva() != null && alinhada.reservaAposOperacao() != null
                && alinhada.reservaAposOperacao().compareTo(alinhada.pisoReserva()) < 0) {
            return baseBloqueio(alinhada, diferencialPp,
                    RecomendacaoAmortizacao.BLOQUEADO_RESERVA,
                    "Operação derruba a reserva de emergência (líquida diária) abaixo do piso configurado.",
                    bases, horizonteDias, aliquotaIr);
        }

        BigDecimal taxaCronograma = alinhada.taxaJurosNominalAaPercent() != null
                ? MoneyMath.percentToDecimal(alinhada.taxaJurosNominalAaPercent())
                : cet;
        List<ParcelaCronograma> cronograma = CronogramaAmortizacaoCalculator.gerar(
                alinhada.sistema() == SistemaAmortizacao.CONSORCIO ? SistemaAmortizacao.PRICE : alinhada.sistema(),
                alinhada.saldoDevedor(),
                taxaCronograma,
                alinhada.prazoRemanescenteMeses(),
                alinhada.proximoVencimento() != null ? alinhada.proximoVencimento() : LocalDate.now().plusMonths(1),
                alinhada.segurosTaxasMensais());

        ResultadoAntecipacao antecipacao = simularAntecipacao(
                cronograma, alinhada.valorAmortizar(), alinhada.modalidade());

        BigDecimal economiaVp = ValorPresenteCalculator.valorPresenteJuros(antecipacao.eliminadas(), cet);
        BigDecimal nominalEliminado = ValorPresenteCalculator.valorNominal(antecipacao.eliminadas());
        BigDecimal taxaImplicita = taxaImplicitaAmortizacao(
                alinhada.valorAmortizar(), economiaVp, antecipacao.mesesEliminados());

        RecomendacaoAmortizacao rec = decidir(diferencialPp);
        String explicacao = montarExplicacao(rec, diferencialPp, alinhada, nominalEliminado, economiaVp, taxaImplicita,
                antecipacao.mesesEliminados(), bases);

        return new AmortizacaoComparacao(
                alinhada.cetEfetivoAaPercent(),
                alinhada.retornoAlternativaLiquidaAaPercent(),
                diferencialPp,
                MoneyMath.money(alinhada.valorAmortizar()),
                antecipacao.mesesEliminados(),
                nominalEliminado,
                economiaVp,
                MoneyMath.decimalToPercent(taxaImplicita),
                impactoPatrimonio(alinhada.valorAmortizar(), diferencialPp, 12),
                impactoPatrimonio(alinhada.valorAmortizar(), diferencialPp, 36),
                alinhada.modalidade(),
                rec,
                explicacao,
                alinhada.sistema() == SistemaAmortizacao.CONSORCIO,
                alinhada.consorcioContemplado(),
                antecipacao.eliminadas(),
                bases.base(),
                bases.aviso(),
                horizonteDias,
                aliquotaIr != null ? aliquotaIr.multiply(MoneyMath.HUNDRED).setScale(2, RoundingMode.HALF_UP) : null);
    }

    /** Limiar de reflexão: valor ≥ minimoParcelas × parcela atual. */
    public static boolean acionaPeriodoReflexao(BigDecimal valor, BigDecimal parcelaAtual, BigDecimal minimoParcelas) {
        if (valor == null || parcelaAtual == null) {
            return false;
        }
        BigDecimal min = minimoParcelas != null ? minimoParcelas : BigDecimal.ONE;
        return valor.compareTo(parcelaAtual.multiply(min, MoneyMath.MC)) >= 0;
    }

    private static RecomendacaoAmortizacao decidir(BigDecimal diferencialPp) {
        if (diferencialPp.abs().compareTo(BANDA_INDIFERENCA_PP) <= 0) {
            return RecomendacaoAmortizacao.INDIFERENTE;
        }
        return diferencialPp.compareTo(BigDecimal.ZERO) > 0
                ? RecomendacaoAmortizacao.AMORTIZAR
                : RecomendacaoAmortizacao.MANTER_INVESTIDO;
    }

    private static String montarExplicacao(
            RecomendacaoAmortizacao rec,
            BigDecimal diferencialPp,
            Entrada e,
            BigDecimal nominal,
            BigDecimal economiaVp,
            BigDecimal taxaImplicita,
            int meses,
            BaseComparacaoTaxas.Resultado bases) {
        String base = switch (rec) {
            case AMORTIZAR -> String.format(
                    "CET %.2f%% a.a. supera o retorno líquido da alternativa (%.2f%%) em %.2f p.p. Amortizar cria valor.",
                    e.cetEfetivoAaPercent(), e.retornoAlternativaLiquidaAaPercent(), diferencialPp);
            case MANTER_INVESTIDO -> String.format(
                    "CET %.2f%% a.a. está abaixo do retorno líquido da alternativa (%.2f%%) em %.2f p.p. "
                            + "Amortizar destrói valor — desaconselhado.",
                    e.cetEfetivoAaPercent(), e.retornoAlternativaLiquidaAaPercent(), diferencialPp.abs());
            case INDIFERENTE -> "Diferencial dentro da banda de indiferença (±0,3 p.p.). Decisão neutra sob a ótica de taxa.";
            default -> rec.name();
        };
        String baseInfo = bases.aviso() != null ? " [" + bases.base() + ": " + bases.aviso() + "]" : " [base " + bases.base() + "]";
        return base + baseInfo + String.format(
                " Antecipação elimina %d meses (nominal R$ %s); economia real em valor presente: R$ %s; taxa implícita ≈ %.2f%% a.a. "
                        + "Meses eliminados NÃO são retorno — o ganho é o juro embutido trazido a VP.",
                meses,
                nominal.toPlainString(),
                economiaVp.toPlainString(),
                MoneyMath.decimalToPercent(taxaImplicita));
    }

    static BigDecimal impactoPatrimonio(BigDecimal valor, BigDecimal diferencialPp, int meses) {
        BigDecimal difDecimal = MoneyMath.percentToDecimal(diferencialPp);
        BigDecimal anos = BigDecimal.valueOf(meses).divide(MoneyMath.TWELVE, MoneyMath.MC);
        return MoneyMath.money(valor.multiply(difDecimal, MoneyMath.MC).multiply(anos, MoneyMath.MC));
    }

    static BigDecimal taxaImplicitaAmortizacao(BigDecimal valor, BigDecimal economiaVp, int mesesEliminados) {
        if (valor == null || valor.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal retornoTotal = economiaVp.divide(valor, MoneyMath.MC);
        if (mesesEliminados <= 0) {
            return MoneyMath.rate(retornoTotal);
        }
        double horizonteAnos = Math.max(mesesEliminados / 24.0, 1.0 / 12.0);
        double r = Math.pow(1.0 + retornoTotal.doubleValue(), 1.0 / horizonteAnos) - 1.0;
        if (Double.isNaN(r) || Double.isInfinite(r)) {
            return MoneyMath.rate(retornoTotal);
        }
        return MoneyMath.rate(BigDecimal.valueOf(r));
    }

    record ResultadoAntecipacao(int mesesEliminados, List<ParcelaCronograma> eliminadas) {
    }

    static ResultadoAntecipacao simularAntecipacao(
            List<ParcelaCronograma> cronograma,
            BigDecimal valorAmortizar,
            AmortizacaoComparacao.ModalidadeAmortizacao modalidade) {
        if (cronograma.isEmpty() || valorAmortizar.compareTo(BigDecimal.ZERO) <= 0) {
            return new ResultadoAntecipacao(0, List.of());
        }

        if (modalidade == AmortizacaoComparacao.ModalidadeAmortizacao.REDUZIR_PARCELA) {
            BigDecimal saldoIni = cronograma.stream()
                    .map(ParcelaCronograma::amortizacao)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal proporcao = valorAmortizar.divide(saldoIni.max(BigDecimal.ONE), MoneyMath.MC);
            List<ParcelaCronograma> virtual = new ArrayList<>();
            for (ParcelaCronograma p : cronograma) {
                BigDecimal jEv = MoneyMath.money(p.juros().multiply(proporcao, MoneyMath.MC));
                virtual.add(new ParcelaCronograma(
                        p.numero(), p.vencimento(), jEv, MoneyMath.ZERO, jEv, MoneyMath.ZERO, p.saldoApos()));
            }
            return new ResultadoAntecipacao(0, virtual);
        }

        BigDecimal restante = MoneyMath.money(valorAmortizar);
        List<ParcelaCronograma> eliminadas = new ArrayList<>();
        for (int i = cronograma.size() - 1; i >= 0 && restante.compareTo(BigDecimal.ZERO) > 0; i--) {
            ParcelaCronograma p = cronograma.get(i);
            if (p.amortizacao().compareTo(restante) <= 0) {
                eliminadas.add(0, p);
                restante = MoneyMath.money(restante.subtract(p.amortizacao()));
            } else {
                BigDecimal proporcao = restante.divide(p.amortizacao().max(BigDecimal.ONE), MoneyMath.MC);
                BigDecimal jParcial = MoneyMath.money(p.juros().multiply(proporcao, MoneyMath.MC));
                eliminadas.add(0, new ParcelaCronograma(
                        p.numero(), p.vencimento(),
                        MoneyMath.money(restante.add(jParcial)),
                        restante, jParcial, MoneyMath.ZERO, MoneyMath.ZERO));
                restante = MoneyMath.ZERO;
            }
        }
        return new ResultadoAntecipacao(eliminadas.size(), eliminadas);
    }

    private static AmortizacaoComparacao baseBloqueio(
            Entrada e, BigDecimal diferencialPp,
            RecomendacaoAmortizacao rec, String msg,
            BaseComparacaoTaxas.Resultado bases, Integer horizonteDias, BigDecimal aliquotaIr) {
        return new AmortizacaoComparacao(
                e.cetEfetivoAaPercent(),
                e.retornoAlternativaLiquidaAaPercent(),
                diferencialPp,
                MoneyMath.money(e.valorAmortizar()),
                0,
                MoneyMath.ZERO,
                MoneyMath.ZERO,
                MoneyMath.ZERO.setScale(4, RoundingMode.HALF_UP),
                MoneyMath.ZERO,
                MoneyMath.ZERO,
                e.modalidade(),
                rec,
                msg,
                e.sistema() == SistemaAmortizacao.CONSORCIO,
                e.consorcioContemplado(),
                List.of(),
                bases.base(),
                bases.aviso(),
                horizonteDias,
                aliquotaIr != null ? aliquotaIr.multiply(MoneyMath.HUNDRED).setScale(2, RoundingMode.HALF_UP) : null);
    }
}
