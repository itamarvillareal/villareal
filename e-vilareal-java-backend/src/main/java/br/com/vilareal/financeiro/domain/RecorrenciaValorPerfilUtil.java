package br.com.vilareal.financeiro.domain;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Perfil de valor e classificação de precisão para padrões recorrentes. */
public final class RecorrenciaValorPerfilUtil {

    private static final MathContext MC = MathContext.DECIMAL64;
    private static final BigDecimal TOLERANCIA_APROX = new BigDecimal("0.05");
    private static final double LIMIAR_PARTICIPACAO_MODAL = 0.80;
    private static final double LIMIAR_DISPERSAO_FIXO = 0.02;

    private RecorrenciaValorPerfilUtil() {}

    public enum ClassePrecisao {
        EXATO,
        APROXIMADO,
        DIVERGENTE
    }

    public record PerfilValor(
            BigDecimal valorModal, double participacaoModal, double dispersao, boolean valorFixo) {}

    public record ContagensPrecisao(
            long pendentesExato,
            long pendentesAprox,
            long pendentesDivergente,
            long completarExato,
            long completarAprox,
            long completarDivergente) {

        public long totalExato() {
            return pendentesExato + completarExato;
        }

        public long totalAprox() {
            return pendentesAprox + completarAprox;
        }

        public long totalDivergente() {
            return pendentesDivergente + completarDivergente;
        }

        public long totalTodos() {
            return totalExato() + totalAprox() + totalDivergente();
        }

        public long totalAcionavel(PrecisaoValorRecorrencia filtro) {
            if (filtro.ignoraValor()) {
                return totalTodos();
            }
            long total = 0;
            if (filtro.incluiExatos()) {
                total += totalExato();
            }
            if (filtro.incluiAproximados()) {
                total += totalAprox();
            }
            return total;
        }
    }

    public static PerfilValor calcularPerfil(List<BigDecimal> valoresBrutos) {
        if (valoresBrutos == null || valoresBrutos.isEmpty()) {
            return new PerfilValor(null, 0.0, 0.0, false);
        }
        List<BigDecimal> valores =
                valoresBrutos.stream().filter(v -> v != null).map(v -> v.setScale(2, RoundingMode.HALF_UP)).toList();
        if (valores.isEmpty()) {
            return new PerfilValor(null, 0.0, 0.0, false);
        }

        Map<BigDecimal, Long> freq = new HashMap<>();
        for (BigDecimal v : valores) {
            freq.merge(v, 1L, Long::sum);
        }
        BigDecimal modal = null;
        long cntModal = 0;
        for (Map.Entry<BigDecimal, Long> e : freq.entrySet()) {
            if (e.getValue() > cntModal
                    || (e.getValue() == cntModal && (modal == null || e.getKey().compareTo(modal) < 0))) {
                cntModal = e.getValue();
                modal = e.getKey();
            }
        }
        if (modal == null) {
            modal = valores.get(0);
            cntModal = 1;
        }

        double participacao = (double) cntModal / valores.size();
        double dispersao = calcularCoeficienteVariacao(valores);
        boolean valorFixo = participacao >= LIMIAR_PARTICIPACAO_MODAL || dispersao < LIMIAR_DISPERSAO_FIXO;
        return new PerfilValor(modal, participacao, dispersao, valorFixo);
    }

    public static ClassePrecisao classificar(BigDecimal valor, BigDecimal valorModal) {
        if (valorModal == null || valor == null) {
            return ClassePrecisao.DIVERGENTE;
        }
        BigDecimal v = valor.setScale(2, RoundingMode.HALF_UP);
        BigDecimal modal = valorModal.setScale(2, RoundingMode.HALF_UP);
        if (v.compareTo(modal) == 0) {
            return ClassePrecisao.EXATO;
        }
        BigDecimal ref = modal.abs();
        if (ref.compareTo(BigDecimal.ZERO) == 0) {
            return ClassePrecisao.DIVERGENTE;
        }
        BigDecimal diff = v.subtract(modal).abs();
        BigDecimal limite = ref.multiply(TOLERANCIA_APROX, MC);
        if (diff.compareTo(limite) <= 0) {
            return ClassePrecisao.APROXIMADO;
        }
        return ClassePrecisao.DIVERGENTE;
    }

    public static boolean aceita(ClassePrecisao classe, PrecisaoValorRecorrencia filtro) {
        return switch (classe) {
            case EXATO -> filtro.incluiExatos() || filtro.ignoraValor();
            case APROXIMADO -> filtro.incluiAproximados() || filtro.ignoraValor();
            case DIVERGENTE -> filtro.ignoraValor();
        };
    }

    private static double calcularCoeficienteVariacao(List<BigDecimal> valores) {
        double[] nums = valores.stream().mapToDouble(BigDecimal::doubleValue).toArray();
        double mean = 0;
        for (double n : nums) {
            mean += n;
        }
        mean /= nums.length;
        if (Math.abs(mean) < 1e-9) {
            return 0.0;
        }
        double sumSq = 0;
        for (double n : nums) {
            double d = n - mean;
            sumSq += d * d;
        }
        double stddev = Math.sqrt(sumSq / nums.length);
        return stddev / Math.abs(mean);
    }
}
