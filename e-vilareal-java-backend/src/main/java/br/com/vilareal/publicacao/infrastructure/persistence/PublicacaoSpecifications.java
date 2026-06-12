package br.com.vilareal.publicacao.infrastructure.persistence;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Subquery;
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
            Long clientePk,
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
            if (clientePk != null && clientePk > 0) {
                preds.add(cb.equal(root.join("cliente", JoinType.INNER).get("id"), clientePk));
            }
            if (StringUtils.hasText(origemImportacao)) {
                preds.add(cb.equal(root.get("origemImportacao"), origemImportacao.trim()));
            }
            if (StringUtils.hasText(texto)) {
                String q = "%" + texto.trim().toLowerCase(Locale.ROOT) + "%";
                List<Predicate> textoOr = new ArrayList<>();
                textoOr.add(cb.like(cb.lower(root.get("numeroProcessoEncontrado")), q));
                textoOr.add(cb.like(cb.lower(root.get("teor")), q));
                textoOr.add(cb.like(cb.lower(root.get("resumo")), q));
                textoOr.add(cb.like(cb.lower(root.get("diario")), q));
                textoOr.add(cb.like(cb.lower(root.get("tipoPublicacao")), q));
                textoOr.add(cb.like(cb.lower(root.get("fonte")), q));
                textoOr.add(cb.like(cb.lower(root.get("titulo")), q));
                // Metadados Projudi/TRT (parteAutor, parteReu, etc.) ficam em jsonReferencia, não sempre no teor.
                textoOr.add(cb.like(cb.lower(root.get("jsonReferencia")), q));

                Subquery<Long> sqParte = query.subquery(Long.class);
                var ppRoot = sqParte.from(ProcessoParteEntity.class);
                var pessoaJoin = ppRoot.join("pessoa", JoinType.LEFT);
                sqParte.select(ppRoot.get("id"));
                sqParte.where(
                        cb.equal(ppRoot.get("processo").get("id"), root.get("processo").get("id")),
                        cb.or(
                                cb.like(cb.lower(pessoaJoin.get("nome")), q),
                                cb.like(cb.lower(ppRoot.get("nomeLivre")), q)));
                textoOr.add(cb.and(cb.isNotNull(root.get("processo")), cb.exists(sqParte)));

                preds.add(cb.or(textoOr.toArray(Predicate[]::new)));
            }
            return preds.isEmpty() ? cb.conjunction() : cb.and(preds.toArray(Predicate[]::new));
        };
    }
}
