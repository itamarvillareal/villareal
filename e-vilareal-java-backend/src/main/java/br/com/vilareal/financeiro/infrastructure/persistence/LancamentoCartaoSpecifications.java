package br.com.vilareal.financeiro.infrastructure.persistence;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoCartaoEntity;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;

public final class LancamentoCartaoSpecifications {

    private LancamentoCartaoSpecifications() {}

    public static Specification<LancamentoCartaoEntity> comFiltros(
            Long clienteId,
            Long processoId,
            Long contaContabilId,
            Long cartaoId,
            LocalDate dataInicio,
            LocalDate dataFim,
            Boolean fechamentoAutomatico) {
        return (root, query, cb) -> {
            var preds = cb.conjunction();
            if (Boolean.TRUE.equals(fechamentoAutomatico)) {
                preds = cb.and(preds, cb.like(root.get("numeroLancamento"), "AUTO-FAT-%"));
            }
            if (clienteId != null) {
                preds = cb.and(preds, cb.equal(root.get("clienteEntidade").get("id"), clienteId));
            }
            if (processoId != null) {
                preds = cb.and(preds, cb.equal(root.get("processo").get("id"), processoId));
            }
            if (contaContabilId != null) {
                preds = cb.and(preds, cb.equal(root.get("contaContabil").get("id"), contaContabilId));
            }
            if (cartaoId != null) {
                preds = cb.and(preds, cb.equal(root.get("cartao").get("id"), cartaoId));
            }
            if (dataInicio != null) {
                preds = cb.and(preds, cb.greaterThanOrEqualTo(root.get("dataLancamento"), dataInicio));
            }
            if (dataFim != null) {
                preds = cb.and(preds, cb.lessThanOrEqualTo(root.get("dataLancamento"), dataFim));
            }
            return preds;
        };
    }
}
