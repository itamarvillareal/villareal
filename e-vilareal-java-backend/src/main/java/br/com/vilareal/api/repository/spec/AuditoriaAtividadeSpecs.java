package br.com.vilareal.api.repository.spec;

import br.com.vilareal.api.entity.AuditoriaAtividade;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public final class AuditoriaAtividadeSpecs {

    private AuditoriaAtividadeSpecs() {
    }

    public static Specification<AuditoriaAtividade> comFiltros(
            Instant dataInicioInclusive,
            Instant dataFimExclusive,
            String usuarioId,
            String modulo,
            String tipoAcao,
            String registroAfetadoId,
            String textoLivre) {
        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (dataInicioInclusive != null) {
                p.add(cb.greaterThanOrEqualTo(root.get("ocorridoEm"), dataInicioInclusive));
            }
            if (dataFimExclusive != null) {
                p.add(cb.lessThan(root.get("ocorridoEm"), dataFimExclusive));
            }
            if (usuarioId != null && !usuarioId.isBlank()) {
                p.add(cb.equal(root.get("usuarioId"), usuarioId.trim()));
            }
            if (modulo != null && !modulo.isBlank()) {
                p.add(cb.equal(cb.lower(root.get("modulo")), modulo.trim().toLowerCase()));
            }
            if (tipoAcao != null && !tipoAcao.isBlank()) {
                p.add(cb.equal(root.get("tipoAcao"), tipoAcao.trim()));
            }
            if (registroAfetadoId != null && !registroAfetadoId.isBlank()) {
                String idNorm = "%" + registroAfetadoId.trim().toLowerCase() + "%";
                p.add(cb.like(cb.lower(root.get("registroAfetadoId")), idNorm));
            }
            if (textoLivre != null && !textoLivre.isBlank()) {
                String term = "%" + textoLivre.trim().toLowerCase() + "%";
                p.add(cb.or(
                        cb.like(cb.lower(root.get("descricao")), term),
                        cb.like(cb.lower(root.get("registroAfetadoNome")), term),
                        cb.like(cb.lower(root.get("registroAfetadoId")), term),
                        cb.like(cb.lower(root.get("usuarioNome")), term),
                        cb.like(cb.lower(root.get("tela")), term)
                ));
            }
            return p.isEmpty() ? cb.conjunction() : cb.and(p.toArray(Predicate[]::new));
        };
    }
}
