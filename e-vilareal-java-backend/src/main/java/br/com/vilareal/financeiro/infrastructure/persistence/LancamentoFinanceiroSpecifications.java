package br.com.vilareal.financeiro.infrastructure.persistence;

import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.domain.FinanceiroCadastroPlenitude;
import br.com.vilareal.financeiro.domain.StatusLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.imovel.application.ImovelLancamentoFiltroCriteria;
import br.com.vilareal.processo.application.ClienteCodigoPessoaResolver;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
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
        return comFiltros(
                clienteId,
                processoId,
                contaContabilId,
                dataInicio,
                dataFim,
                etapa,
                numeroBanco,
                busca,
                semClienteId,
                semGrupoCompensacao,
                ano,
                mes,
                List.of(),
                false,
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
            Integer mes,
            List<String> contaCodigos,
            boolean excluirContaCodigos) {
        return comFiltros(
                clienteId,
                processoId,
                contaContabilId,
                dataInicio,
                dataFim,
                etapa,
                numeroBanco,
                busca,
                semClienteId,
                semGrupoCompensacao,
                ano,
                mes,
                contaCodigos,
                excluirContaCodigos,
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
            Integer mes,
            List<String> contaCodigos,
            boolean excluirContaCodigos,
            String cadastroPlenitude) {
        Specification<LancamentoFinanceiroEntity> spec = comFiltrosBase(
                clienteId, processoId, contaContabilId, dataInicio, dataFim);
        if (contaCodigos != null && !contaCodigos.isEmpty()) {
            spec = spec.and(comContaCodigos(contaCodigos, excluirContaCodigos));
        }
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
        spec = spec.and(comCadastroPlenitude(cadastroPlenitude));
        return spec.and(somenteAtivos());
    }

    /** Extrato / consolidado: oculta lançamentos aposentados (soft-delete). */
    public static Specification<LancamentoFinanceiroEntity> somenteAtivos() {
        return (root, query, cb) -> cb.equal(root.get("status"), StatusLancamento.ATIVO);
    }

    /** Ex.: {@code A,E,F} — letras de conta contábil para filtro do extrato. */
    public static List<String> parseContaCodigosParam(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.toUpperCase(Locale.ROOT))
                .distinct()
                .toList();
    }

    public static Specification<LancamentoFinanceiroEntity> comContaCodigos(
            List<String> contaCodigos, boolean excluir) {
        return (root, query, cb) -> {
            if (contaCodigos == null || contaCodigos.isEmpty()) {
                return null;
            }
            var j = root.join("contaContabil", JoinType.INNER);
            var upperCodigos = contaCodigos.stream()
                    .map(s -> s.toUpperCase(Locale.ROOT))
                    .toList();
            var inPred = cb.upper(j.get("codigo")).in(upperCodigos);
            return excluir ? cb.not(inPred) : inPred;
        };
    }

    /**
     * Cadastro pleno: conta definida (≠ N) e vínculos secundários exigidos preenchidos.
     * A → cliente + processo; E → grupo de compensação; demais contas → só a letra.
     */
    public static Specification<LancamentoFinanceiroEntity> comCadastroPleno() {
        return (root, query, cb) -> {
            var conta = root.join("contaContabil", JoinType.INNER);
            var codigo = cb.upper(conta.get("codigo"));
            var notN = cb.notEqual(codigo, "N");

            var aPleno = cb.and(
                    cb.equal(codigo, "A"),
                    cb.isNotNull(root.get("clienteEntidade")),
                    cb.isNotNull(root.get("processo")));

            var ePleno = cb.and(
                    cb.equal(codigo, "E"),
                    cb.isNotNull(root.get("grupoCompensacao")),
                    cb.notEqual(root.get("grupoCompensacao"), ""));

            var iPleno = cb.and(
                    cb.equal(codigo, "I"),
                    cb.isNotNull(root.get("grupoCompensacao")),
                    cb.notEqual(root.get("grupoCompensacao"), ""));

            var demaisPleno = cb.and(
                    cb.notEqual(codigo, "N"),
                    cb.notEqual(codigo, "A"),
                    cb.notEqual(codigo, "E"),
                    cb.notEqual(codigo, "I"));

            return cb.and(notN, cb.or(aPleno, ePleno, iPleno, demaisPleno));
        };
    }

    /** Cadastro parcial: conta A ou E (ou outra com exigência) sem vínculo secundário completo. */
    public static Specification<LancamentoFinanceiroEntity> comCadastroParcial() {
        return (root, query, cb) -> {
            var conta = root.join("contaContabil", JoinType.INNER);
            var codigo = cb.upper(conta.get("codigo"));

            var aParcial = cb.and(
                    cb.equal(codigo, "A"),
                    cb.or(
                            cb.isNull(root.get("clienteEntidade")),
                            cb.isNull(root.get("processo"))));

            var eParcial = cb.and(
                    cb.equal(codigo, "E"),
                    cb.or(
                            cb.isNull(root.get("grupoCompensacao")),
                            cb.equal(root.get("grupoCompensacao"), "")));

            var iParcial = cb.and(
                    cb.equal(codigo, "I"),
                    cb.or(
                            cb.isNull(root.get("grupoCompensacao")),
                            cb.equal(root.get("grupoCompensacao"), "")));

            return cb.or(aParcial, eParcial, iParcial);
        };
    }

    public static Specification<LancamentoFinanceiroEntity> comCadastroPlenitude(String plenitude) {
        String modo = FinanceiroCadastroPlenitude.normalizarFiltro(plenitude);
        if (FinanceiroCadastroPlenitude.PLENO.equals(modo)) {
            return comCadastroPleno();
        }
        if (FinanceiroCadastroPlenitude.PARCIAL.equals(modo)) {
            return comCadastroParcial();
        }
        return (root, query, cb) -> null;
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

    public static Specification<LancamentoFinanceiroEntity> comNumerosBanco(java.util.Collection<Integer> numeros) {
        return (root, query, cb) -> {
            if (numeros == null || numeros.isEmpty()) {
                return cb.disjunction();
            }
            return root.get("numeroBanco").in(numeros);
        };
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

    /**
     * Filtro por código de cliente exibido (coluna Cod. Cliente), alinhado à Conta Corrente do processo.
     * Aceita PK de {@code cliente}, {@code codigo_cliente} normalizado ou {@code pessoa_ref} legado.
     */
    public static Specification<LancamentoFinanceiroEntity> comCodigoClienteExibicao(
            String codigoNormOito, Long clientePk, Long pessoaIdResolvida) {
        if ((codigoNormOito == null || codigoNormOito.isBlank()) && clientePk == null && pessoaIdResolvida == null) {
            return null;
        }
        return (root, query, cb) -> {
            List<Predicate> preds = new ArrayList<>();
            if (clientePk != null) {
                var clienteJoin = root.join("clienteEntidade", JoinType.LEFT);
                preds.add(cb.equal(clienteJoin.get("id"), clientePk));
            }
            if (codigoNormOito != null && !codigoNormOito.isBlank()) {
                var clienteJoin = root.join("clienteEntidade", JoinType.LEFT);
                preds.add(cb.equal(clienteJoin.get("codigoCliente"), codigoNormOito));
                String compact = ClienteCodigoPessoaResolver.compactarChaveSoDigitos(codigoNormOito);
                if (!compact.equals(codigoNormOito)) {
                    preds.add(cb.equal(clienteJoin.get("codigoCliente"), compact));
                }
            }
            if (pessoaIdResolvida != null) {
                var pessoaJoin = root.join("pessoaRef", JoinType.LEFT);
                preds.add(cb.equal(pessoaJoin.get("id"), pessoaIdResolvida));
            }
            if (preds.isEmpty()) {
                return cb.disjunction();
            }
            return cb.or(preds.toArray(Predicate[]::new));
        };
    }

    /**
     * Filtro por nº do imóvel na planilha (conta I): valor persistido em {@code grupo_compensacao}.
     */
    public static Specification<LancamentoFinanceiroEntity> comNumeroImovel(String numeroImovelNormalizado) {
        if (numeroImovelNormalizado == null || numeroImovelNormalizado.isBlank()) {
            return null;
        }
        String norm = numeroImovelNormalizado.trim();
        return (root, query, cb) -> cb.equal(root.get("grupoCompensacao"), norm);
    }

    /**
     * Filtro ampliado por imóvel (conta I): grupo_compensacao, processos, repasses e prefixos Cod.+Proc. na Obs.
     */
    public static Specification<LancamentoFinanceiroEntity> comFiltroImovelPlanilha(
            ImovelLancamentoFiltroCriteria criteria) {
        if (criteria == null || criteria.isEmpty()) {
            return (root, query, cb) -> cb.disjunction();
        }
        return (root, query, cb) -> {
            List<Predicate> ors = new ArrayList<>();
            if (StringUtils.hasText(criteria.numeroPlanilha())) {
                ors.add(cb.equal(root.get("grupoCompensacao"), criteria.numeroPlanilha().trim()));
            }
            if (criteria.processoIds() != null && !criteria.processoIds().isEmpty()) {
                var processoJoin = root.join("processo", JoinType.LEFT);
                ors.add(processoJoin.get("id").in(criteria.processoIds()));
            }
            if (criteria.lancamentoFinanceiroIds() != null && !criteria.lancamentoFinanceiroIds().isEmpty()) {
                ors.add(root.get("id").in(criteria.lancamentoFinanceiroIds()));
            }
            if (criteria.obsPrefixos() != null) {
                for (String prefixo : criteria.obsPrefixos()) {
                    if (prefixo == null || prefixo.isBlank()) {
                        continue;
                    }
                    String like = prefixo.trim().toLowerCase(Locale.ROOT) + "%";
                    ors.add(cb.like(cb.lower(root.get("descricaoDetalhada")), like));
                }
            }
            if (ors.isEmpty()) {
                return cb.disjunction();
            }
            return cb.or(ors.toArray(Predicate[]::new));
        };
    }

    /**
     * Filtro por proc. exibido (coluna Proc.): {@code processo.numero_interno} ou {@code grupo_compensacao}.
     */
    public static Specification<LancamentoFinanceiroEntity> comProcExibicao(Integer numeroInterno) {
        if (numeroInterno == null) {
            return null;
        }
        return (root, query, cb) -> {
            var processoJoin = root.join("processo", JoinType.LEFT);
            if (numeroInterno == 0) {
                return cb.or(
                        cb.equal(root.get("grupoCompensacao"), "0"),
                        cb.isNull(processoJoin.get("numeroInterno")),
                        cb.equal(processoJoin.get("numeroInterno"), 0));
            }
            Predicate porProcesso = cb.equal(processoJoin.get("numeroInterno"), numeroInterno);
            Predicate porGrupo = cb.equal(root.get("grupoCompensacao"), String.valueOf(numeroInterno));
            return cb.or(porProcesso, porGrupo);
        };
    }
}
