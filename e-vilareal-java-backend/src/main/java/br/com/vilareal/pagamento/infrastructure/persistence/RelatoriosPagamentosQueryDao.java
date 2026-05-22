package br.com.vilareal.pagamento.infrastructure.persistence;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public class RelatoriosPagamentosQueryDao {

    private static final String STATUS_PAGOS =
            "'PAGO_CONFIRMADO','PAGO_SEM_COMPROVANTE','CONFERIDO','ACERTADO'";

    @PersistenceContext
    private EntityManager em;

    @SuppressWarnings("unchecked")
    public List<Object[]> gastosPorImovelCategoria(
            LocalDate inicio, LocalDate fim, Long clienteId, List<String> categorias) {
        StringBuilder sql = new StringBuilder(
                """
                SELECT p.imovel_id, p.categoria,
                       SUM(COALESCE(p.valor_pago_banco, p.valor)) AS total
                FROM pagamento p
                LEFT JOIN imovel i ON i.id = p.imovel_id
                WHERE p.status IN (%s)
                  AND p.data_pagamento_efetivo IS NOT NULL
                  AND p.data_pagamento_efetivo BETWEEN :inicio AND :fim
                  AND p.imovel_id IS NOT NULL
                """
                        .formatted(STATUS_PAGOS));
        if (clienteId != null) {
            sql.append(" AND (p.cliente_id = :clienteId OR i.cliente_id = :clienteId)");
        }
        if (categorias != null && !categorias.isEmpty()) {
            sql.append(" AND p.categoria IN :categorias");
        }
        sql.append(" GROUP BY p.imovel_id, p.categoria ORDER BY p.imovel_id, p.categoria");
        Query q = em.createNativeQuery(sql.toString());
        q.setParameter("inicio", inicio);
        q.setParameter("fim", fim);
        if (clienteId != null) {
            q.setParameter("clienteId", clienteId);
        }
        if (categorias != null && !categorias.isEmpty()) {
            q.setParameter("categorias", categorias);
        }
        return q.getResultList();
    }

    @SuppressWarnings("unchecked")
    public List<Object[]> comparativoMensal(int ano, Long imovelId) {
        StringBuilder sql = new StringBuilder(
                """
                SELECT MONTH(p.data_pagamento_efetivo) AS mes, p.categoria,
                       SUM(COALESCE(p.valor_pago_banco, p.valor)) AS total
                FROM pagamento p
                WHERE p.status IN (%s)
                  AND p.data_pagamento_efetivo IS NOT NULL
                  AND YEAR(p.data_pagamento_efetivo) = :ano
                """
                        .formatted(STATUS_PAGOS));
        if (imovelId != null) {
            sql.append(" AND p.imovel_id = :imovelId");
        }
        sql.append(" GROUP BY MONTH(p.data_pagamento_efetivo), p.categoria");
        sql.append(" ORDER BY mes, p.categoria");
        Query q = em.createNativeQuery(sql.toString());
        q.setParameter("ano", ano);
        if (imovelId != null) {
            q.setParameter("imovelId", imovelId);
        }
        return q.getResultList();
    }

    @SuppressWarnings("unchecked")
    public List<Object[]> lucratividadeAcertados(LocalDate inicio, LocalDate fim) {
        String sql =
                """
                SELECT p.id AS pagamento_id, p.imovel_id,
                       COALESCE(p.valor_pago_banco, p.valor) AS valor_pago
                FROM pagamento p
                WHERE p.status = 'ACERTADO'
                  AND p.data_acerto BETWEEN :inicio AND :fim
                  AND p.imovel_id IS NOT NULL
                """;
        Query q = em.createNativeQuery(sql);
        q.setParameter("inicio", inicio);
        q.setParameter("fim", fim);
        return q.getResultList();
    }

    @SuppressWarnings("unchecked")
    public List<Object[]> prestacaoTaxaPorPagamentoIds(List<Long> pagamentoIds) {
        if (pagamentoIds == null || pagamentoIds.isEmpty()) {
            return List.of();
        }
        String sql =
                """
                SELECT pcp.pagamento_id, pc.id AS prestacao_id,
                       pc.taxa_administracao_valor,
                       (SELECT SUM(COALESCE(p2.valor_pago_banco, p2.valor))
                        FROM prestacao_contas_pagamento pcp2
                        JOIN pagamento p2 ON p2.id = pcp2.pagamento_id
                        WHERE pcp2.prestacao_contas_id = pc.id) AS total_prestacao
                FROM prestacao_contas_pagamento pcp
                JOIN prestacao_contas pc ON pc.id = pcp.prestacao_contas_id
                WHERE pcp.pagamento_id IN :pagamentoIds
                  AND pc.status IN ('ENVIADO', 'APROVADO')
                  AND pc.taxa_administracao_valor IS NOT NULL
                """;
        Query q = em.createNativeQuery(sql);
        q.setParameter("pagamentoIds", pagamentoIds);
        return q.getResultList();
    }

    public Double tempoMedioIdentificacaoAgendamento(LocalDate inicio, LocalDate fim) {
        return avgDatediff(
                """
                SELECT AVG(DATEDIFF(p.data_agendamento, p.data_cadastro))
                FROM pagamento p
                WHERE p.data_agendamento IS NOT NULL
                  AND p.data_agendamento BETWEEN :inicio AND :fim
                """,
                inicio,
                fim);
    }

    public Double tempoMedioAgendamentoPagamento(LocalDate inicio, LocalDate fim) {
        return avgDatediff(
                """
                SELECT AVG(DATEDIFF(p.data_pagamento_efetivo, p.data_agendamento))
                FROM pagamento p
                WHERE p.data_pagamento_efetivo IS NOT NULL
                  AND p.data_agendamento IS NOT NULL
                  AND p.data_pagamento_efetivo BETWEEN :inicio AND :fim
                """,
                inicio,
                fim);
    }

    public long countAgendadosNoPeriodo(LocalDate inicio, LocalDate fim) {
        Number n = (Number)
                em.createNativeQuery(
                                """
                                SELECT COUNT(*) FROM pagamento p
                                WHERE p.data_agendamento IS NOT NULL
                                  AND p.data_agendamento BETWEEN :inicio AND :fim
                                """)
                        .setParameter("inicio", inicio)
                        .setParameter("fim", fim)
                        .getSingleResult();
        return n != null ? n.longValue() : 0L;
    }

    public long countFalhaBancariaAtual(LocalDate inicio, LocalDate fim) {
        Number n = (Number)
                em.createNativeQuery(
                                """
                                SELECT COUNT(*) FROM pagamento p
                                WHERE p.status IN ('PAGO_SEM_COMPROVANTE', 'CONFERENCIA_PENDENTE')
                                  AND p.data_agendamento IS NOT NULL
                                  AND p.data_agendamento BETWEEN :inicio AND :fim
                                """)
                        .setParameter("inicio", inicio)
                        .setParameter("fim", fim)
                        .getSingleResult();
        return n != null ? n.longValue() : 0L;
    }

    public long countConferidosNoPeriodo(LocalDate inicio, LocalDate fim) {
        Number n = (Number)
                em.createNativeQuery(
                                """
                                SELECT COUNT(*) FROM pagamento p
                                WHERE p.data_conferencia IS NOT NULL
                                  AND p.data_conferencia BETWEEN :inicio AND :fim
                                """)
                        .setParameter("inicio", inicio)
                        .setParameter("fim", fim)
                        .getSingleResult();
        return n != null ? n.longValue() : 0L;
    }

    public long countDivergenciaNoPeriodo(LocalDate inicio, LocalDate fim) {
        Number n = (Number)
                em.createNativeQuery(
                                """
                                SELECT COUNT(*) FROM pagamento p
                                WHERE p.data_conferencia IS NOT NULL
                                  AND p.data_conferencia BETWEEN :inicio AND :fim
                                  AND p.valor_pago_banco IS NOT NULL
                                  AND p.valor_diferenca IS NOT NULL
                                  AND p.valor_diferenca != 0
                                """)
                        .setParameter("inicio", inicio)
                        .setParameter("fim", fim)
                        .getSingleResult();
        return n != null ? n.longValue() : 0L;
    }

    public long countCriadosNoPeriodo(LocalDate inicio, LocalDate fim) {
        Number n = (Number)
                em.createNativeQuery(
                                """
                                SELECT COUNT(*) FROM pagamento p
                                WHERE p.data_cadastro BETWEEN :inicio AND :fim
                                """)
                        .setParameter("inicio", inicio)
                        .setParameter("fim", fim)
                        .getSingleResult();
        return n != null ? n.longValue() : 0L;
    }

    public long countVencidosHistoricoNoPeriodo(LocalDate inicio, LocalDate fim) {
        Number n = (Number)
                em.createNativeQuery(
                                """
                                SELECT COUNT(DISTINCT h.pagamento_id) FROM pagamento_historico h
                                WHERE h.status_novo = 'VENCIDO'
                                  AND h.criado_em >= :inicioTs
                                  AND h.criado_em < :fimTs
                                """)
                        .setParameter("inicioTs", inicio.atStartOfDay())
                        .setParameter("fimTs", fim.plusDays(1).atStartOfDay())
                        .getSingleResult();
        return n != null ? n.longValue() : 0L;
    }

    @SuppressWarnings("unchecked")
    public List<Object[]> pendenciasSnapshot() {
        return em.createNativeQuery(
                        """
                        SELECT p.imovel_id, p.status, COUNT(*) AS qtd,
                               SUM(COALESCE(p.valor_pago_banco, p.valor)) AS valor_total
                        FROM pagamento p
                        WHERE p.status NOT IN ('ACERTADO', 'CANCELADO', 'SUBSTITUIDO')
                        GROUP BY p.imovel_id, p.status
                        ORDER BY p.imovel_id, p.status
                        """)
                .getResultList();
    }

    private Double avgDatediff(String sql, LocalDate inicio, LocalDate fim) {
        Object r = em.createNativeQuery(sql)
                .setParameter("inicio", inicio)
                .setParameter("fim", fim)
                .getSingleResult();
        if (r == null) {
            return null;
        }
        if (r instanceof Number num) {
            return num.doubleValue();
        }
        return null;
    }
}
