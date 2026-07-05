package br.com.vilareal.calculo.infrastructure.persistence;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Repository
public class CalculoParcelamentosConsolidadoQueryDao {

    @PersistenceContext
    private EntityManager em;

    public record ParcelaRow(
            String codigoCliente,
            int numeroProcesso,
            int dimensao,
            int indiceParcela,
            String dataVencimentoBr,
            String dataPagamentoBr,
            String valorParcela,
            String honorariosParcela,
            Long processoId,
            String unidade,
            String reuCabecalho,
            int totalParcelasInformada) {}

    /**
     * Extrai parcelas de rodadas com parcelamento aceito via {@code JSON_TABLE} (MySQL 8+).
     */
    @SuppressWarnings("unchecked")
    public List<ParcelaRow> listarParcelasRaw(
            String codigoCliente8,
            List<Integer> processos,
            LocalDate vencimentoDe,
            LocalDate vencimentoAte,
            String situacaoFiltro,
            LocalDate hoje) {
        StringBuilder sql = new StringBuilder(
                """
                SELECT
                  cr.codigo_cliente,
                  cr.numero_processo,
                  cr.dimensao,
                  (jt.parcela_idx - 1) AS indice_parcela,
                  jt.data_vencimento,
                  jt.data_pagamento,
                  jt.valor_parcela,
                  jt.honorarios_parcela,
                  p.id AS processo_id,
                  p.unidade,
                  JSON_UNQUOTE(JSON_EXTRACT(cr.payload_json, '$.cabecalho.reu')) AS reu_cab,
                  CAST(
                    NULLIF(REGEXP_REPLACE(
                      COALESCE(JSON_UNQUOTE(JSON_EXTRACT(cr.payload_json, '$.quantidadeParcelasInformada')), '0'),
                      '[^0-9]', ''), '')
                    AS UNSIGNED
                  ) AS qtd_parcelas
                FROM calculo_rodada cr
                CROSS JOIN JSON_TABLE(
                  cr.payload_json,
                  '$.parcelas[*]' COLUMNS (
                    parcela_idx FOR ORDINALITY,
                    data_vencimento VARCHAR(20) PATH '$.dataVencimento',
                    data_pagamento VARCHAR(20) PATH '$.dataPagamento',
                    valor_parcela VARCHAR(64) PATH '$.valorParcela',
                    honorarios_parcela VARCHAR(64) PATH '$.honorariosParcela'
                  )
                ) jt
                LEFT JOIN cliente c ON c.codigo_cliente = cr.codigo_cliente
                LEFT JOIN processo p ON p.cliente_id = c.id AND p.numero_interno = cr.numero_processo
                WHERE cr.parcelamento_aceito = 1
                  AND NULLIF(TRIM(jt.valor_parcela), '') IS NOT NULL
                """);

        if (codigoCliente8 != null && !codigoCliente8.isBlank()) {
            sql.append(" AND cr.codigo_cliente = :codigoCliente ");
        }
        if (processos != null && !processos.isEmpty()) {
            sql.append(" AND cr.numero_processo IN :processos ");
        }

        sql.append(situacaoSqlClause(situacaoFiltro, hoje));

        if (vencimentoDe != null) {
            sql.append(
                    """
                     AND STR_TO_DATE(jt.data_vencimento, '%d/%m/%Y') >= :vencimentoDe
                    """);
        }
        if (vencimentoAte != null) {
            sql.append(
                    """
                     AND STR_TO_DATE(jt.data_vencimento, '%d/%m/%Y') <= :vencimentoAte
                    """);
        }

        Query q = em.createNativeQuery(sql.toString());
        if (codigoCliente8 != null && !codigoCliente8.isBlank()) {
            q.setParameter("codigoCliente", codigoCliente8);
        }
        if (processos != null && !processos.isEmpty()) {
            q.setParameter("processos", processos);
        }
        if (vencimentoDe != null) {
            q.setParameter("vencimentoDe", vencimentoDe);
        }
        if (vencimentoAte != null) {
            q.setParameter("vencimentoAte", vencimentoAte);
        }
        if (needsHojeParam(situacaoFiltro)) {
            q.setParameter("hoje", hoje);
        }

        List<Object[]> rows = q.getResultList();
        List<ParcelaRow> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            out.add(new ParcelaRow(
                    str(r[0]),
                    intVal(r[1]),
                    intVal(r[2]),
                    intVal(r[3]),
                    str(r[4]),
                    str(r[5]),
                    str(r[6]),
                    str(r[7]),
                    longObj(r[8]),
                    str(r[9]),
                    str(r[10]),
                    intVal(r[11])));
        }
        return out;
    }

    private static String situacaoSqlClause(String situacaoFiltro, LocalDate hoje) {
        if (situacaoFiltro == null || situacaoFiltro.isBlank() || "todas".equalsIgnoreCase(situacaoFiltro)) {
            return "";
        }
        String baseVenc = "STR_TO_DATE(jt.data_vencimento, '%d/%m/%Y')";
        String temPag = "NULLIF(TRIM(jt.data_pagamento), '') IS NOT NULL";
        String semPag = "NULLIF(TRIM(jt.data_pagamento), '') IS NULL";
        return switch (situacaoFiltro.toLowerCase(Locale.ROOT)) {
            case "pagas" -> " AND " + temPag + " ";
            case "vencidas" -> " AND " + semPag + " AND " + baseVenc + " < :hoje ";
            case "a_vencer" -> " AND " + semPag + " AND " + baseVenc + " >= :hoje ";
            case "em_aberto" -> " AND " + semPag + " ";
            default -> "";
        };
    }

    private static boolean needsHojeParam(String situacaoFiltro) {
        if (situacaoFiltro == null) {
            return false;
        }
        String s = situacaoFiltro.toLowerCase(Locale.ROOT);
        return "vencidas".equals(s) || "a_vencer".equals(s);
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static int intVal(Object o) {
        if (o == null) {
            return 0;
        }
        if (o instanceof Number n) {
            return n.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static Long longObj(Object o) {
        if (o == null) {
            return null;
        }
        if (o instanceof Number n) {
            return n.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
