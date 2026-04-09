package br.com.vilareal.importacao;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.importacao.infrastructure.persistence.entity.PlanilhaPasta1ClienteEntity;
import br.com.vilareal.processo.application.CodigoClienteUtil;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Normalização coluna A → código 8 dígitos e desempate quando há mais de uma linha na tabela para o mesmo
 * cliente (ex.: chaves {@code "6"} e {@code "00000006"}).
 */
public final class PlanilhaPasta1MapeamentoUtil {

    private PlanilhaPasta1MapeamentoUtil() {}

    public static String codigoClienteExibicaoParaChavePlanilha(String chave) {
        String t = chave == null ? "" : chave.trim();
        if (t.isEmpty()) {
            return null;
        }
        if (!t.chars().allMatch(Character::isDigit)) {
            return null;
        }
        String n = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(t);
        return n.isEmpty() ? null : n;
    }

    /**
     * Entre linhas cujo código normalizado coincide com o de {@code codigoClienteOuChave}: prefere
     * {@code updated_at} mais recente; em empate, prefere {@code pessoa_id ≠ número do cliente} (evita
     * confundir código com id de pessoa quando há duplicidade de import).
     */
    public static Optional<PlanilhaPasta1ClienteEntity> escolherMelhorMapeamento(
            List<PlanilhaPasta1ClienteEntity> todos, String codigoClienteOuChave) {
        if (todos == null || todos.isEmpty() || codigoClienteOuChave == null || codigoClienteOuChave.isBlank()) {
            return Optional.empty();
        }
        final String cod8;
        try {
            cod8 = CodigoClienteUtil.formatar(CodigoClienteUtil.parsePessoaId(codigoClienteOuChave.trim()));
        } catch (BusinessRuleException e) {
            return Optional.empty();
        }
        long numeroCliente;
        try {
            numeroCliente = CodigoClienteUtil.parsePessoaId(cod8);
        } catch (BusinessRuleException e) {
            return Optional.empty();
        }
        List<PlanilhaPasta1ClienteEntity> matches = new ArrayList<>();
        for (PlanilhaPasta1ClienteEntity m : todos) {
            String c8 = codigoClienteExibicaoParaChavePlanilha(m.getChaveCliente());
            if (cod8.equals(c8)) {
                matches.add(m);
            }
        }
        if (matches.isEmpty()) {
            return Optional.empty();
        }
        return escolherEntreCandidatos(matches, numeroCliente);
    }

    public static Optional<PlanilhaPasta1ClienteEntity> escolherEntreCandidatos(
            List<PlanilhaPasta1ClienteEntity> matches, long numeroCliente) {
        if (matches == null || matches.isEmpty()) {
            return Optional.empty();
        }
        List<PlanilhaPasta1ClienteEntity> copy = new ArrayList<>(matches);
        Comparator<PlanilhaPasta1ClienteEntity> byUpdatedDesc =
                (a, b) -> {
                    Instant ua = a.getUpdatedAt();
                    Instant ub = b.getUpdatedAt();
                    if (ua == null && ub == null) {
                        return 0;
                    }
                    if (ua == null) {
                        return 1;
                    }
                    if (ub == null) {
                        return -1;
                    }
                    return ub.compareTo(ua);
                };
        copy.sort(byUpdatedDesc.thenComparing(m -> m.getPessoaId().equals(numeroCliente)));
        return Optional.of(copy.get(0));
    }
}
