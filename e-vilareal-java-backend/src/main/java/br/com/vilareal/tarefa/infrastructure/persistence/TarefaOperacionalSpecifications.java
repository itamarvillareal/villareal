package br.com.vilareal.tarefa.infrastructure.persistence;

import br.com.vilareal.tarefa.infrastructure.persistence.entity.TarefaOperacionalEntity;
import br.com.vilareal.tarefa.model.TarefaPrioridade;
import br.com.vilareal.tarefa.model.TarefaStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public final class TarefaOperacionalSpecifications {

    private TarefaOperacionalSpecifications() {
    }

    public static Specification<TarefaOperacionalEntity> comFiltros(
            Long responsavelId,
            TarefaStatus status,
            TarefaPrioridade prioridade,
            Long clienteId,
            Long processoId,
            LocalDate dataLimiteDe,
            LocalDate dataLimiteAte) {
        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (responsavelId != null) {
                p.add(cb.equal(root.get("responsavel").get("id"), responsavelId));
            }
            if (status != null) {
                p.add(cb.equal(root.get("status"), status));
            }
            if (prioridade != null) {
                p.add(cb.equal(root.get("prioridade"), prioridade));
            }
            if (clienteId != null) {
                p.add(cb.equal(root.get("clienteId"), clienteId));
            }
            if (processoId != null) {
                p.add(cb.equal(root.get("processoId"), processoId));
            }
            if (dataLimiteDe != null) {
                p.add(cb.greaterThanOrEqualTo(root.get("dataLimite"), dataLimiteDe));
            }
            if (dataLimiteAte != null) {
                p.add(cb.lessThanOrEqualTo(root.get("dataLimite"), dataLimiteAte));
            }
            if (p.isEmpty()) {
                return cb.conjunction();
            }
            return cb.and(p.toArray(Predicate[]::new));
        };
    }
}
