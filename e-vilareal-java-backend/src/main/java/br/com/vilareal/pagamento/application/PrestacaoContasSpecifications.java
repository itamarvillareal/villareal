package br.com.vilareal.pagamento.application;

import br.com.vilareal.pagamento.domain.PrestacaoContasStatus;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PrestacaoContasEntity;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;

public final class PrestacaoContasSpecifications {

    private PrestacaoContasSpecifications() {}

    public static Specification<PrestacaoContasEntity> comFiltros(
            Long clienteId, PrestacaoContasStatus status, LocalDate periodoInicio, LocalDate periodoFim) {
        return (root, query, cb) -> {
            var preds = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            if (clienteId != null) {
                preds.add(cb.equal(root.get("cliente").get("id"), clienteId));
            }
            if (status != null) {
                preds.add(cb.equal(root.get("status"), status));
            }
            if (periodoInicio != null) {
                preds.add(cb.greaterThanOrEqualTo(root.get("periodoFim"), periodoInicio));
            }
            if (periodoFim != null) {
                preds.add(cb.lessThanOrEqualTo(root.get("periodoInicio"), periodoFim));
            }
            return cb.and(preds.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }
}
