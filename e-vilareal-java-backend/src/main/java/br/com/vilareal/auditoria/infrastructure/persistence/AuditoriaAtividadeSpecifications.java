package br.com.vilareal.auditoria.infrastructure.persistence;

import br.com.vilareal.auditoria.infrastructure.persistence.entity.AuditoriaAtividadeEntity;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

public final class AuditoriaAtividadeSpecifications {

    private static final ZoneId ZONA_BR = ZoneId.of("America/Sao_Paulo");

    private AuditoriaAtividadeSpecifications() {}

    public static Specification<AuditoriaAtividadeEntity> comFiltros(
            LocalDate dataInicio,
            LocalDate dataFim,
            String usuarioRef,
            String modulo,
            String tipoAcao,
            String registroAfetadoId,
            String texto) {
        return (root, query, cb) -> {
            List<Predicate> parts = new ArrayList<>();

            if (dataInicio != null) {
                Instant inicio = dataInicio.atStartOfDay(ZONA_BR).toInstant();
                parts.add(cb.greaterThanOrEqualTo(root.get("ocorridoEm"), inicio));
            }
            if (dataFim != null) {
                Instant fimExclusivo = dataFim.plusDays(1).atStartOfDay(ZONA_BR).toInstant();
                parts.add(cb.lessThan(root.get("ocorridoEm"), fimExclusivo));
            }
            if (usuarioRef != null && !usuarioRef.isBlank()) {
                parts.add(cb.equal(root.get("usuarioRef"), usuarioRef.trim()));
            }
            if (modulo != null && !modulo.isBlank()) {
                parts.add(cb.equal(root.get("modulo"), modulo.trim()));
            }
            if (tipoAcao != null && !tipoAcao.isBlank()) {
                parts.add(cb.equal(root.get("tipoAcao"), tipoAcao.trim()));
            }
            if (registroAfetadoId != null && !registroAfetadoId.isBlank()) {
                parts.add(cb.equal(root.get("registroAfetadoId"), registroAfetadoId.trim()));
            }
            if (texto != null && !texto.isBlank()) {
                String pattern = "%" + escapeLike(texto.trim()) + "%";
                Predicate desc = cb.like(cb.lower(root.get("descricao")), pattern.toLowerCase(), '\\');
                Predicate nomeReg = cb.like(cb.lower(root.get("registroAfetadoNome")), pattern.toLowerCase(), '\\');
                Predicate nomeUsu = cb.like(cb.lower(root.get("usuarioNome")), pattern.toLowerCase(), '\\');
                Predicate tela = cb.like(cb.lower(root.get("tela")), pattern.toLowerCase(), '\\');
                Predicate mod = cb.like(cb.lower(root.get("modulo")), pattern.toLowerCase(), '\\');
                parts.add(cb.or(desc, nomeReg, nomeUsu, tela, mod));
            }

            return cb.and(parts.toArray(Predicate[]::new));
        };
    }

    private static String escapeLike(String raw) {
        return raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
