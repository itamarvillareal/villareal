package br.com.vilareal.publicacao.infrastructure.persistence;

import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class PublicacaoSpecifications {

    private PublicacaoSpecifications() {}

    public static Specification<PublicacaoEntity> comFiltros(
            LocalDate dataInicio,
            LocalDate dataFim,
            String statusTratamento,
            Long processoId,
            Long clienteId,
            String texto,
            String origemImportacao) {
        return (root, query, cb) -> {
            List<Predicate> preds = new ArrayList<>();
            if (dataInicio != null) {
                preds.add(
                        cb.greaterThanOrEqualTo(
                                cb.coalesce(root.get("dataPublicacao"), root.get("dataDisponibilizacao")),
                                dataInicio));
            }
            if (dataFim != null) {
                preds.add(
                        cb.lessThanOrEqualTo(
                                cb.coalesce(root.get("dataPublicacao"), root.get("dataDisponibilizacao")),
                                dataFim));
            }
            if (StringUtils.hasText(statusTratamento)) {
                preds.add(cb.equal(root.get("statusTratamento"), statusTratamento.trim()));
            }
            if (processoId != null && processoId > 0) {
                preds.add(cb.equal(root.join("processo", JoinType.INNER).get("id"), processoId));
            }
            if (clienteId != null && clienteId > 0) {
                preds.add(cb.equal(root.get("clienteRefId"), clienteId));
            }
            if (StringUtils.hasText(origemImportacao)) {
                preds.add(cb.equal(root.get("origemImportacao"), origemImportacao.trim()));
            }
            if (StringUtils.hasText(texto)) {
                String q = "%" + texto.trim().toLowerCase(Locale.ROOT) + "%";
                preds.add(
                        cb.or(
                                cb.like(cb.lower(root.get("numeroProcessoEncontrado")), q),
                                cb.like(cb.lower(root.get("teor")), q),
                                cb.like(cb.lower(root.get("resumo")), q),
                                cb.like(cb.lower(root.get("diario")), q),
                                cb.like(cb.lower(root.get("tipoPublicacao")), q),
                                cb.like(cb.lower(root.get("fonte")), q)));
            }
            return preds.isEmpty() ? cb.conjunction() : cb.and(preds.toArray(Predicate[]::new));
        };
    }
}
