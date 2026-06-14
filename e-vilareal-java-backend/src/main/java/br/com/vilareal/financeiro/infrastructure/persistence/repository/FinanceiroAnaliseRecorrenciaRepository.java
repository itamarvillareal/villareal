package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Repository
public class FinanceiroAnaliseRecorrenciaRepository {

    private static final String SQL_PADROES = """
            WITH base AS (
                SELECT l.descricao_norm, l.numero_banco, l.banco_nome, l.descricao,
                       l.conta_contabil_id, l.valor, l.data_lancamento, l.etapa,
                       UPPER(TRIM(c.codigo)) AS conta_codigo
                FROM financeiro_lancamento l
                INNER JOIN financeiro_conta_contabil c ON c.id = l.conta_contabil_id
                WHERE l.status = 'ATIVO'
                  AND UPPER(TRIM(c.codigo)) <> 'N'
                  AND l.descricao_norm IS NOT NULL
                  AND l.descricao_norm <> ''
                  AND (:numeroBanco IS NULL OR l.numero_banco = :numeroBanco)
            ),
            hist AS (
                SELECT descricao_norm, numero_banco, banco_nome, descricao, conta_contabil_id, valor,
                       data_lancamento, conta_codigo
                FROM base
                WHERE etapa <> 'IMPORTADO'
            ),
            exemplo_rank AS (
                SELECT descricao_norm, numero_banco, descricao AS descricao_exemplo,
                       data_lancamento AS data_exemplo,
                       ROW_NUMBER() OVER (
                           PARTITION BY descricao_norm, numero_banco
                           ORDER BY data_lancamento DESC, descricao DESC
                       ) AS rn
                FROM base
            ),
            totais AS (
                SELECT descricao_norm, numero_banco,
                       MAX(banco_nome) AS banco_nome,
                       COUNT(*) AS ocorrencias_historico,
                       COUNT(DISTINCT YEAR(data_lancamento) * 100 + MONTH(data_lancamento)) AS meses_cobertos,
                       AVG(valor) AS valor_medio
                FROM hist
                GROUP BY descricao_norm, numero_banco
            ),
            conta_rank AS (
                SELECT descricao_norm, numero_banco, conta_contabil_id,
                       COUNT(*) AS cnt_conta,
                       ROW_NUMBER() OVER (
                           PARTITION BY descricao_norm, numero_banco
                           ORDER BY COUNT(*) DESC, conta_contabil_id
                       ) AS rn
                FROM hist
                GROUP BY descricao_norm, numero_banco, conta_contabil_id
            ),
            pend AS (
                SELECT l.descricao_norm, l.numero_banco, COUNT(*) AS qtd_pendentes
                FROM financeiro_lancamento l
                WHERE l.etapa = 'IMPORTADO'
                  AND l.status = 'ATIVO'
                  AND l.descricao_norm IS NOT NULL
                  AND l.descricao_norm <> ''
                  AND (:numeroBanco IS NULL OR l.numero_banco = :numeroBanco)
                GROUP BY l.descricao_norm, l.numero_banco
            )
            SELECT t.descricao_norm,
                   t.numero_banco,
                   t.banco_nome,
                   ex.descricao_exemplo,
                   ex.data_exemplo,
                   t.ocorrencias_historico,
                   t.meses_cobertos,
                   t.valor_medio,
                   cr.conta_contabil_id,
                   cr.cnt_conta,
                   COALESCE(p.qtd_pendentes, 0) AS qtd_pendentes,
                   cc.codigo AS conta_codigo,
                   cc.nome AS conta_nome
            FROM totais t
            INNER JOIN conta_rank cr
                ON cr.descricao_norm = t.descricao_norm
               AND cr.numero_banco = t.numero_banco
               AND cr.rn = 1
            INNER JOIN financeiro_conta_contabil cc ON cc.id = cr.conta_contabil_id
            LEFT JOIN pend p
                ON p.descricao_norm = t.descricao_norm
               AND p.numero_banco = t.numero_banco
            LEFT JOIN exemplo_rank ex
                ON ex.descricao_norm = t.descricao_norm
               AND ex.numero_banco = t.numero_banco
               AND ex.rn = 1
            WHERE (:contaContabilId IS NULL OR cr.conta_contabil_id = :contaContabilId)
            """;

    private static final String SQL_VINCULO_DOMINANTE = """
            SELECT l.cliente_id, l.processo_id, COUNT(*) AS cnt
            FROM financeiro_lancamento l
            INNER JOIN financeiro_conta_contabil c ON c.id = l.conta_contabil_id
            WHERE l.etapa <> 'IMPORTADO'
              AND l.status = 'ATIVO'
              AND UPPER(TRIM(c.codigo)) = 'A'
              AND l.descricao_norm = :descricaoNorm
              AND l.numero_banco = :numeroBanco
              AND l.conta_contabil_id = :contaContabilId
              AND l.cliente_id IS NOT NULL
            GROUP BY l.cliente_id, l.processo_id
            ORDER BY cnt DESC, l.cliente_id, l.processo_id
            LIMIT 1
            """;

    private static final String SQL_CNT_COM_VINCULO_COMPLETO = """
            SELECT COUNT(*)
            FROM financeiro_lancamento l
            INNER JOIN financeiro_conta_contabil c ON c.id = l.conta_contabil_id
            WHERE l.etapa <> 'IMPORTADO'
              AND l.status = 'ATIVO'
              AND UPPER(TRIM(c.codigo)) = 'A'
              AND l.descricao_norm = :descricaoNorm
              AND l.numero_banco = :numeroBanco
              AND l.conta_contabil_id = :contaContabilId
              AND l.cliente_id IS NOT NULL
              AND l.processo_id IS NOT NULL
            """;

    @PersistenceContext
    private EntityManager entityManager;

    @SuppressWarnings("unchecked")
    public List<PadraoRecorrenciaRow> listarPadroesAgregados(Integer numeroBanco, Long contaContabilId) {
        Query q = entityManager.createNativeQuery(SQL_PADROES);
        q.setParameter("numeroBanco", numeroBanco);
        q.setParameter("contaContabilId", contaContabilId);
        List<Object[]> rows = q.getResultList();
        List<PadraoRecorrenciaRow> out = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            out.add(mapPadraoRow(row));
        }
        return out;
    }

    public VinculoDominanteRow buscarVinculoDominanteContaA(
            String descricaoNorm, Integer numeroBanco, Long contaContabilId) {
        Query q = entityManager.createNativeQuery(SQL_VINCULO_DOMINANTE);
        q.setParameter("descricaoNorm", descricaoNorm);
        q.setParameter("numeroBanco", numeroBanco);
        q.setParameter("contaContabilId", contaContabilId);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        if (rows.isEmpty()) {
            return null;
        }
        Object[] row = rows.get(0);
        VinculoDominanteRow v = new VinculoDominanteRow();
        v.clienteId = row[0] != null ? ((Number) row[0]).longValue() : null;
        v.processoId = row[1] != null ? ((Number) row[1]).longValue() : null;
        v.cnt = row[2] != null ? ((Number) row[2]).longValue() : 0L;
        return v;
    }

    public long contarComVinculoCompletoContaA(String descricaoNorm, Integer numeroBanco, Long contaContabilId) {
        Query q = entityManager.createNativeQuery(SQL_CNT_COM_VINCULO_COMPLETO);
        q.setParameter("descricaoNorm", descricaoNorm);
        q.setParameter("numeroBanco", numeroBanco);
        q.setParameter("contaContabilId", contaContabilId);
        Number n = (Number) q.getSingleResult();
        return n != null ? n.longValue() : 0L;
    }

    private static PadraoRecorrenciaRow mapPadraoRow(Object[] row) {
        PadraoRecorrenciaRow p = new PadraoRecorrenciaRow();
        p.descricaoNorm = row[0] != null ? String.valueOf(row[0]) : "";
        p.numeroBanco = row[1] != null ? ((Number) row[1]).intValue() : null;
        p.bancoNome = row[2] != null ? String.valueOf(row[2]) : null;
        p.descricaoExemplo = row[3] != null ? String.valueOf(row[3]) : null;
        p.dataExemplo = toLocalDate(row[4]);
        p.ocorrenciasHistorico = row[5] != null ? ((Number) row[5]).longValue() : 0L;
        p.mesesCobertos = row[6] != null ? ((Number) row[6]).longValue() : 0L;
        p.valorMedio = row[7] != null ? new BigDecimal(row[7].toString()) : BigDecimal.ZERO;
        p.contaContabilId = row[8] != null ? ((Number) row[8]).longValue() : null;
        p.cntContaDominante = row[9] != null ? ((Number) row[9]).longValue() : 0L;
        p.qtdPendentes = row[10] != null ? ((Number) row[10]).longValue() : 0L;
        p.contaCodigo = row[11] != null ? String.valueOf(row[11]).trim().toUpperCase() : "";
        p.contaNome = row[12] != null ? String.valueOf(row[12]) : null;
        return p;
    }

    private static LocalDate toLocalDate(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof LocalDate ld) {
            return ld;
        }
        if (value instanceof java.sql.Date d) {
            return d.toLocalDate();
        }
        if (value instanceof java.util.Date d) {
            return new java.sql.Date(d.getTime()).toLocalDate();
        }
        return LocalDate.parse(String.valueOf(value).substring(0, 10));
    }

    public static final class PadraoRecorrenciaRow {
        public String descricaoNorm;
        public Integer numeroBanco;
        public String bancoNome;
        public String descricaoExemplo;
        public LocalDate dataExemplo;
        public long ocorrenciasHistorico;
        public long mesesCobertos;
        public BigDecimal valorMedio;
        public Long contaContabilId;
        public long cntContaDominante;
        public long qtdPendentes;
        public String contaCodigo;
        public String contaNome;
    }

    public static final class VinculoDominanteRow {
        public Long clienteId;
        public Long processoId;
        public long cnt;
    }
}
