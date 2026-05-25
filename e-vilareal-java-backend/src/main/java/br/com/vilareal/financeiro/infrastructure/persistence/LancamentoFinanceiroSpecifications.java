package br.com.vilareal.financeiro.infrastructure.persistence;

import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import jakarta.persistence.criteria.JoinType;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

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

    /** Descrição (LIKE) e, se o termo for numérico, valor exato ou faixa parcial (ex.: 244 → 244,48). */
    public static Specification<LancamentoFinanceiroEntity> comBuscaDescricao(String busca) {
        return (root, query, cb) -> {
            if (busca == null || busca.isBlank()) {
                return null;
            }
            String term = busca.trim();
            String like = "%" + term.toUpperCase() + "%";
            var porTexto = cb.or(
                    cb.like(cb.upper(root.get("descricao")), like),
                    cb.like(cb.upper(root.get("descricaoDetalhada")), like));

            List<jakarta.persistence.criteria.Predicate> partes = new ArrayList<>();
            partes.add(porTexto);
            interpretarValorBusca(term).ifPresent(faixa -> partes.add(predicateValor(cb, root, faixa)));
            return cb.or(partes.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }

    private static jakarta.persistence.criteria.Predicate predicateValor(
            jakarta.persistence.criteria.CriteriaBuilder cb,
            jakarta.persistence.criteria.Root<LancamentoFinanceiroEntity> root,
            ValorBuscaFaixa faixa) {
        if (faixa.exato != null) {
            return cb.equal(root.get("valor"), faixa.exato);
        }
        return cb.and(
                cb.greaterThanOrEqualTo(root.get("valor"), faixa.minInclusive),
                cb.lessThan(root.get("valor"), faixa.maxExclusive));
    }

    /**
     * Interpreta termo numérico: inteiro parcial (244 → [244, 245)), centavos parciais (244,4 → [244,40, 244,50))
     * ou valor completo (244,48 → exato).
     */
    private static Optional<ValorBuscaFaixa> interpretarValorBusca(String term) {
        if (term == null || term.isBlank()) {
            return Optional.empty();
        }
        String s = term.replaceAll("[R$\\s]", "");
        if (!s.matches("[-+]?[\\d.,]+")) {
            return Optional.empty();
        }
        s = s.replaceFirst("^[-+]", "");

        try {
            if (s.contains(",")) {
                int comma = s.indexOf(',');
                String intPart = s.substring(0, comma).replace(".", "");
                String decPart = s.substring(comma + 1).replaceAll("\\D", "");
                if (intPart.isEmpty() && decPart.isEmpty()) {
                    return Optional.empty();
                }
                if (intPart.isEmpty()) {
                    intPart = "0";
                }
                if (decPart.length() >= 2) {
                    String cents = decPart.length() > 2 ? decPart.substring(0, 2) : decPart;
                    BigDecimal exato = new BigDecimal(intPart + "." + cents).abs().setScale(2, RoundingMode.HALF_UP);
                    return Optional.of(ValorBuscaFaixa.exato(exato));
                }
                BigDecimal min = decPart.isEmpty()
                        ? new BigDecimal(intPart)
                        : new BigDecimal(intPart + "." + decPart);
                min = min.abs();
                int decLen = decPart.isEmpty() ? 0 : decPart.length();
                BigDecimal increment = decLen == 0
                        ? BigDecimal.ONE
                        : BigDecimal.ONE.movePointLeft(decLen);
                return Optional.of(ValorBuscaFaixa.faixa(min, min.add(increment)));
            }
            if (s.contains(".")) {
                int dot = s.indexOf('.');
                String intPart = s.substring(0, dot).replace(".", "");
                if (intPart.isEmpty()) {
                    intPart = "0";
                }
                String decPart = s.substring(dot + 1).replaceAll("\\D", "");
                if (decPart.length() >= 2) {
                    String cents = decPart.length() > 2 ? decPart.substring(0, 2) : decPart;
                    BigDecimal exato = new BigDecimal(intPart + "." + cents).abs().setScale(2, RoundingMode.HALF_UP);
                    return Optional.of(ValorBuscaFaixa.exato(exato));
                }
                BigDecimal min = decPart.isEmpty()
                        ? new BigDecimal(intPart)
                        : new BigDecimal(intPart + "." + decPart);
                min = min.abs();
                int decLen = decPart.isEmpty() ? 0 : decPart.length();
                BigDecimal increment = decLen == 0
                        ? BigDecimal.ONE
                        : BigDecimal.ONE.movePointLeft(decLen);
                return Optional.of(ValorBuscaFaixa.faixa(min, min.add(increment)));
            }
            // Inteiro sem separador decimal: 244 → [244,00, 245,00) (cobre 244,48)
            String digits = s.replace(".", "");
            if (digits.isEmpty()) {
                return Optional.empty();
            }
            BigDecimal n = new BigDecimal(digits).abs();
            BigDecimal min = n.setScale(2, RoundingMode.UNNECESSARY);
            return Optional.of(ValorBuscaFaixa.faixa(min, min.add(BigDecimal.ONE)));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    private record ValorBuscaFaixa(BigDecimal minInclusive, BigDecimal maxExclusive, BigDecimal exato) {
        static ValorBuscaFaixa exato(BigDecimal v) {
            return new ValorBuscaFaixa(v, v, v);
        }

        static ValorBuscaFaixa faixa(BigDecimal min, BigDecimal max) {
            return new ValorBuscaFaixa(min, max, null);
        }
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
