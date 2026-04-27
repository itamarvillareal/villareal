package br.com.vilareal.pagamento.application;

import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public final class PagamentoSpecifications {

    private PagamentoSpecifications() {}

    public record FiltroLista(
            String descricaoContains,
            String codigoBarrasContains,
            BigDecimal valorIgual,
            String status,
            String categoria,
            Long responsavelUsuarioId,
            String formaPagamento,
            String prioridade,
            String origemContains,
            LocalDate vencimentoDe,
            LocalDate vencimentoAte,
            LocalDate agendamentoDe,
            LocalDate agendamentoAte,
            Long clienteId,
            Long processoId,
            Long imovelId,
            String condominioContains,
            Boolean somenteVencidos,
            Boolean somenteConferenciaPendente,
            Boolean proximos7Dias,
            Boolean mesAtual,
            Boolean somenteSemComprovante,
            Boolean altoValorMin) {

        public boolean temAlgum() {
            return descricaoContains != null
                    || codigoBarrasContains != null
                    || valorIgual != null
                    || status != null
                    || categoria != null
                    || responsavelUsuarioId != null
                    || formaPagamento != null
                    || prioridade != null
                    || origemContains != null
                    || vencimentoDe != null
                    || vencimentoAte != null
                    || agendamentoDe != null
                    || agendamentoAte != null
                    || clienteId != null
                    || processoId != null
                    || imovelId != null
                    || condominioContains != null
                    || Boolean.TRUE.equals(somenteVencidos)
                    || Boolean.TRUE.equals(somenteConferenciaPendente)
                    || Boolean.TRUE.equals(proximos7Dias)
                    || Boolean.TRUE.equals(mesAtual)
                    || Boolean.TRUE.equals(somenteSemComprovante)
                    || Boolean.TRUE.equals(altoValorMin);
        }
    }

    public static Specification<PagamentoEntity> comFiltros(FiltroLista f, LocalDate hoje) {
        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (f.descricaoContains() != null && !f.descricaoContains().isBlank()) {
                String d = "%" + f.descricaoContains().trim().toLowerCase() + "%";
                p.add(cb.like(cb.lower(root.get("descricao")), d));
            }
            if (f.codigoBarrasContains() != null && !f.codigoBarrasContains().isBlank()) {
                String d = "%" + f.codigoBarrasContains().trim() + "%";
                p.add(cb.like(root.get("codigoBarras"), d));
            }
            if (f.valorIgual() != null) {
                p.add(cb.equal(root.get("valor"), f.valorIgual()));
            }
            if (f.status() != null && !f.status().isBlank()) {
                p.add(cb.equal(root.get("status"), f.status().trim()));
            }
            if (f.categoria() != null && !f.categoria().isBlank()) {
                p.add(cb.equal(root.get("categoria"), f.categoria().trim()));
            }
            if (f.responsavelUsuarioId() != null) {
                p.add(cb.equal(root.join("responsavelUsuario").get("id"), f.responsavelUsuarioId()));
            }
            if (f.formaPagamento() != null && !f.formaPagamento().isBlank()) {
                p.add(cb.equal(root.get("formaPagamento"), f.formaPagamento().trim()));
            }
            if (f.prioridade() != null && !f.prioridade().isBlank()) {
                p.add(cb.equal(root.get("prioridade"), f.prioridade().trim()));
            }
            if (f.origemContains() != null && !f.origemContains().isBlank()) {
                String d = "%" + f.origemContains().trim().toLowerCase() + "%";
                p.add(cb.like(cb.lower(root.get("origem")), d));
            }
            if (f.vencimentoDe() != null) {
                p.add(cb.greaterThanOrEqualTo(root.get("dataVencimento"), f.vencimentoDe()));
            }
            if (f.vencimentoAte() != null) {
                p.add(cb.lessThanOrEqualTo(root.get("dataVencimento"), f.vencimentoAte()));
            }
            if (f.agendamentoDe() != null) {
                p.add(cb.greaterThanOrEqualTo(root.get("dataAgendamento"), f.agendamentoDe()));
            }
            if (f.agendamentoAte() != null) {
                p.add(cb.lessThanOrEqualTo(root.get("dataAgendamento"), f.agendamentoAte()));
            }
            if (f.clienteId() != null) {
                p.add(cb.equal(root.join("cliente", JoinType.INNER).get("id"), f.clienteId()));
            }
            if (f.processoId() != null) {
                p.add(cb.equal(root.join("processo", JoinType.INNER).get("id"), f.processoId()));
            }
            if (f.imovelId() != null) {
                p.add(cb.equal(root.join("imovel", JoinType.INNER).get("id"), f.imovelId()));
            }
            if (f.condominioContains() != null && !f.condominioContains().isBlank()) {
                String d = "%" + f.condominioContains().trim().toLowerCase() + "%";
                p.add(cb.like(cb.lower(root.get("condominioTexto")), d));
            }
            if (Boolean.TRUE.equals(f.somenteVencidos())) {
                p.add(cb.lessThan(root.get("dataVencimento"), hoje));
                p.add(cb.not(root.get("status").in(
                        PagamentoDominio.ST_PAGO_CONFIRMADO,
                        PagamentoDominio.ST_PAGO_SEM_COMPROVANTE,
                        PagamentoDominio.ST_CANCELADO,
                        PagamentoDominio.ST_SUBSTITUIDO)));
            }
            if (Boolean.TRUE.equals(f.somenteConferenciaPendente())) {
                p.add(cb.equal(root.get("status"), PagamentoDominio.ST_CONFERENCIA_PENDENTE));
            }
            if (Boolean.TRUE.equals(f.proximos7Dias())) {
                LocalDate lim = hoje.plusDays(7);
                p.add(cb.between(root.get("dataVencimento"), hoje, lim));
            }
            if (Boolean.TRUE.equals(f.mesAtual())) {
                LocalDate ini = hoje.withDayOfMonth(1);
                LocalDate fim = ini.plusMonths(1).minusDays(1);
                p.add(cb.between(root.get("dataVencimento"), ini, fim));
            }
            if (Boolean.TRUE.equals(f.somenteSemComprovante())) {
                p.add(cb.equal(root.get("status"), PagamentoDominio.ST_PAGO_SEM_COMPROVANTE));
            }
            if (Boolean.TRUE.equals(f.altoValorMin())) {
                p.add(cb.greaterThanOrEqualTo(root.get("valor"), new BigDecimal("10000")));
            }

            if (p.isEmpty()) {
                return cb.conjunction();
            }
            return cb.and(p.toArray(Predicate[]::new));
        };
    }
}
