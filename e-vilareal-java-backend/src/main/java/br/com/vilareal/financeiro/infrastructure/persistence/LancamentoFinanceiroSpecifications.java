package br.com.vilareal.financeiro.infrastructure.persistence;

import br.com.vilareal.financeiro.domain.EtapaLancamento;
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
        return comFiltros(
                clienteId,
                processoId,
                contaContabilId,
                dataInicio,
                dataFim,
                null,
                null,
                null,
                null,
                null,
                null,
                null);
    }

    public static Specification<LancamentoFinanceiroEntity> comFiltros(
            Long clienteId,
            Long processoId,
            Long contaContabilId,
            LocalDate dataInicio,
            LocalDate dataFim,
            EtapaLancamento etapa,
            Integer numeroBanco,
            String busca,
            Boolean semClienteId,
            Boolean semGrupoCompensacao,
            Integer ano,
            Integer mes) {
        Specification<LancamentoFinanceiroEntity> spec = comFiltrosBase(
                clienteId, processoId, contaContabilId, dataInicio, dataFim);
        if (etapa != null) {
            spec = spec.and(comEtapa(etapa));
        }
        if (numeroBanco != null) {
            spec = spec.and(comNumeroBanco(numeroBanco));
        }
        if (busca != null && !busca.isBlank()) {
            spec = spec.and(comBuscaDescricao(busca));
        }
        if (Boolean.TRUE.equals(semClienteId)) {
            spec = spec.and(semClienteId());
        }
        if (Boolean.TRUE.equals(semGrupoCompensacao)) {
            spec = spec.and(semGrupoCompensacao());
        }
        if (ano != null && mes != null) {
            spec = spec.and(comMes(ano, mes));
        } else if (ano != null) {
            spec = spec.and(comAno(ano));
        }
        return spec;
    }

    private static Specification<LancamentoFinanceiroEntity> comFiltrosBase(
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
                var j = root.join("clienteEntidade", JoinType.INNER);
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

    public static Specification<LancamentoFinanceiroEntity> comEtapa(EtapaLancamento etapa) {
        return (root, query, cb) -> etapa == null ? null : cb.equal(root.get("etapa"), etapa);
    }

    public static Specification<LancamentoFinanceiroEntity> comNumeroBanco(Integer numeroBanco) {
        return (root, query, cb) -> numeroBanco == null ? null : cb.equal(root.get("numeroBanco"), numeroBanco);
    }

    public static Specification<LancamentoFinanceiroEntity> comBuscaDescricao(String busca) {
        return (root, query, cb) -> {
            if (busca == null || busca.isBlank()) {
                return null;
            }
            String like = "%" + busca.trim().toUpperCase() + "%";
            return cb.or(
                    cb.like(cb.upper(root.get("descricao")), like),
                    cb.like(cb.upper(root.get("descricaoDetalhada")), like));
        };
    }

    public static Specification<LancamentoFinanceiroEntity> semClienteId() {
        return (root, query, cb) -> cb.isNull(root.get("clienteEntidade"));
    }

    public static Specification<LancamentoFinanceiroEntity> semGrupoCompensacao() {
        return (root, query, cb) -> cb.or(
                cb.isNull(root.get("grupoCompensacao")),
                cb.equal(root.get("grupoCompensacao"), ""));
    }

    public static Specification<LancamentoFinanceiroEntity> comMes(Integer ano, Integer mes) {
        return (root, query, cb) -> {
            if (ano == null || mes == null) {
                return null;
            }
            LocalDate inicio = LocalDate.of(ano, mes, 1);
            LocalDate fim = inicio.plusMonths(1).minusDays(1);
            return cb.between(root.get("dataLancamento"), inicio, fim);
        };
    }

    public static Specification<LancamentoFinanceiroEntity> comAno(Integer ano) {
        return (root, query, cb) -> {
            if (ano == null) {
                return null;
            }
            LocalDate inicio = LocalDate.of(ano, 1, 1);
            LocalDate fim = LocalDate.of(ano, 12, 31);
            return cb.between(root.get("dataLancamento"), inicio, fim);
        };
    }
}
