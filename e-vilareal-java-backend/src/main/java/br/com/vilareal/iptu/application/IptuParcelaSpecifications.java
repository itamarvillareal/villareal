package br.com.vilareal.iptu.application;

import br.com.vilareal.iptu.infrastructure.persistence.entity.IptuParcelaEntity;
import jakarta.persistence.criteria.JoinType;
import org.springframework.data.jpa.domain.Specification;

public final class IptuParcelaSpecifications {

    private IptuParcelaSpecifications() {}

    public static Specification<IptuParcelaEntity> comFiltros(
            Long imovelId, Short ano, Long contratoId, String status, String competenciaInicio, String competenciaFim) {
        return (root, q, cb) -> {
            var pred = cb.conjunction();
            var anual = root.join("iptuAnual", JoinType.INNER);
            var imovel = anual.join("imovel", JoinType.INNER);
            if (imovelId != null) {
                pred = cb.and(pred, cb.equal(imovel.get("id"), imovelId));
            }
            if (ano != null) {
                pred = cb.and(pred, cb.equal(anual.get("anoReferencia"), ano));
            }
            if (contratoId != null) {
                pred = cb.and(pred, cb.equal(root.join("contratoLocacao", JoinType.INNER).get("id"), contratoId));
            }
            if (status != null && !status.isBlank()) {
                pred = cb.and(pred, cb.equal(root.get("status"), status.trim()));
            }
            if (competenciaInicio != null && !competenciaInicio.isBlank()) {
                pred = cb.and(pred, cb.greaterThanOrEqualTo(root.get("competenciaMes"), competenciaInicio.trim()));
            }
            if (competenciaFim != null && !competenciaFim.isBlank()) {
                pred = cb.and(pred, cb.lessThanOrEqualTo(root.get("competenciaMes"), competenciaFim.trim()));
            }
            return pred;
        };
    }
}
