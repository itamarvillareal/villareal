package br.com.vilareal.financeiro.infrastructure.persistence;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import jakarta.persistence.criteria.JoinType;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;

public final class LancamentoFinanceiroSpecifications {

    private LancamentoFinanceiroSpecifications() {
    }

    public static Specification<LancamentoFinanceiroEntity> comFiltros(
            Long clienteId,
            Long processoId,
            Long contaContabilId,
            LocalDate dataInicio,
            LocalDate dataFim) {
        return (root, query, cb) -> {
            if (query != null) {
                query.distinct(true);
            }
            var p = cb.conjunction();
            if (clienteId != null) {
                var j = root.join("cliente", JoinType.INNER);
                p = cb.and(p, cb.equal(j.get("id"), clienteId));
            }
            if (processoId != null) {
                var j = root.join("processo", JoinType.INNER);
                p = cb.and(p, cb.equal(j.get("id"), processoId));
            }
            if (contaContabilId != null) {
                var j = root.join("contaContabil", JoinType.INNER);
                p = cb.and(p, cb.equal(j.get("id"), contaContabilId));
            }
            if (dataInicio != null) {
                p = cb.and(p, cb.greaterThanOrEqualTo(root.get("dataLancamento"), dataInicio));
            }
            if (dataFim != null) {
                p = cb.and(p, cb.lessThanOrEqualTo(root.get("dataLancamento"), dataFim));
            }
            return p;
        };
    }
}
