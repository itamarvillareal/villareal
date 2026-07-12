package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.LancamentoFinanceiroResponse;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Visão canônica de elos de compensação: prioriza contas novas da API (CONTA ZERO / extrato real)
 * e ignora contas manuais legadas (9/17/18) quando já migradas.
 */
final class CompensacaoEloCanonicoSupport {

    static final int NUMERO_BANCO_CONTA_ZERO = 19;

    private static final Set<Integer> BANCOS_MANUAL_LEGADO = Set.of(9, 17, 18);

    private CompensacaoEloCanonicoSupport() {}

    static List<LancamentoFinanceiroResponse> canonizarResposta(
            List<LancamentoFinanceiroResponse> lancamentos, ContaBancariaApplicationService contaBancariaService) {
        if (lancamentos == null || lancamentos.isEmpty()) {
            return List.of();
        }
        List<LancamentoFinanceiroResponse> filtrados = filtrarLegadoSubstituido(lancamentos, contaBancariaService);
        filtrados.sort(comparadorPrioridade(contaBancariaService));
        return filtrados;
    }

    private static List<LancamentoFinanceiroResponse> filtrarLegadoSubstituido(
            List<LancamentoFinanceiroResponse> lancamentos, ContaBancariaApplicationService contaBancariaService) {
        boolean temContaZero = lancamentos.stream().anyMatch(l -> isContaZero(l, contaBancariaService));
        if (!temContaZero) {
            return new ArrayList<>(lancamentos);
        }
        Set<String> valoresContaZero = new HashSet<>();
        for (LancamentoFinanceiroResponse l : lancamentos) {
            if (isContaZero(l, contaBancariaService) && l.getValor() != null) {
                valoresContaZero.add(chaveValor(l));
            }
        }
        List<LancamentoFinanceiroResponse> out = new ArrayList<>();
        for (LancamentoFinanceiroResponse l : lancamentos) {
            if (isManualLegado(l.getNumeroBanco()) && valoresContaZero.contains(chaveValor(l))) {
                continue;
            }
            out.add(l);
        }
        return out;
    }

    private static Comparator<LancamentoFinanceiroResponse> comparadorPrioridade(
            ContaBancariaApplicationService contaBancariaService) {
        return Comparator.<LancamentoFinanceiroResponse>comparingInt(
                        l -> prioridadeBanco(l.getNumeroBanco(), contaBancariaService))
                .thenComparing(l -> l.getDataLancamento() != null ? l.getDataLancamento().toString() : "")
                .thenComparing(l -> l.getId() != null ? l.getId() : 0L);
    }

    private static int prioridadeBanco(Integer numeroBanco, ContaBancariaApplicationService contaBancariaService) {
        if (numeroBanco == null) {
            return 50;
        }
        if (numeroBanco == NUMERO_BANCO_CONTA_ZERO
                || contaBancariaService.exigeSomaZero(numeroBanco)) {
            return 0;
        }
        if (isManualLegado(numeroBanco)) {
            return 90;
        }
        return 10;
    }

    static boolean isManualLegado(Integer numeroBanco) {
        return numeroBanco != null && BANCOS_MANUAL_LEGADO.contains(numeroBanco);
    }

    private static boolean isContaZero(
            LancamentoFinanceiroResponse l, ContaBancariaApplicationService contaBancariaService) {
        Integer nb = l.getNumeroBanco();
        return nb != null
                && (nb == NUMERO_BANCO_CONTA_ZERO || contaBancariaService.exigeSomaZero(nb));
    }

    private static String chaveValor(LancamentoFinanceiroResponse l) {
        String nat = l.getNatureza() != null ? l.getNatureza().name() : "";
        String val = l.getValor() != null ? l.getValor().toPlainString() : "";
        return nat + "|" + val;
    }
}
