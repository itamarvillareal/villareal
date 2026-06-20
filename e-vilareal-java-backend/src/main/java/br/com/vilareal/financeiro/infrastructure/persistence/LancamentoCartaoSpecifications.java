package br.com.vilareal.financeiro.infrastructure.persistence;

import jakarta.persistence.criteria.JoinType;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
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
            } else {
                preds = cb.and(preds, cb.not(cb.like(root.get("numeroLancamento"), "AUTO-FAT-%")));
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

    public static Specification<LancamentoCartaoEntity> inboxClassificar(
            Integer numeroCartao, EtapaLancamento etapa, Integer ano, Integer mes) {
        return (root, query, cb) -> {
            if (query != null && !Long.class.equals(query.getResultType())) {
                root.fetch("cartao", JoinType.INNER);
                root.fetch("contaContabil", JoinType.INNER);
                query.distinct(true);
            }
            var preds = cb.conjunction();
            preds = cb.and(preds, cb.not(cb.like(root.get("numeroLancamento"), "AUTO-FAT-%")));
            if (etapa != null) {
                preds = cb.and(preds, cb.equal(root.get("etapa"), etapa));
            }
            if (numeroCartao != null) {
                preds = cb.and(preds, cb.equal(root.get("cartao").get("numeroCartao"), numeroCartao));
            }
            if (ano != null && mes != null) {
                LocalDate inicio = LocalDate.of(ano, mes, 1);
                LocalDate fim = inicio.plusMonths(1).minusDays(1);
                preds = cb.and(preds, cb.between(root.get("dataLancamento"), inicio, fim));
            } else if (ano != null) {
                LocalDate inicio = LocalDate.of(ano, 1, 1);
                LocalDate fim = LocalDate.of(ano, 12, 31);
                preds = cb.and(preds, cb.between(root.get("dataLancamento"), inicio, fim));
            }
            return preds;
        };
    }
}
