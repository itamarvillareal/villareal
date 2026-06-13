package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Repository
public class FinanceiroAnaliseRecorrenciaRepository {

    private static final String SQL_PADROES = """
            WITH hist AS (
                SELECT l.descricao_norm, l.numero_banco, l.banco_nome, l.descricao,
                       l.conta_contabil_id, l.valor, l.data_lancamento,
                       UPPER(TRIM(c.codigo)) AS conta_codigo
                FROM financeiro_lancamento l
                INNER JOIN financeiro_conta_contabil c ON c.id = l.conta_contabil_id
                WHERE l.etapa <> 'IMPORTADO'
                  AND l.status = 'ATIVO'
                  AND UPPER(TRIM(c.codigo)) <> 'N'
                  AND l.descricao_norm IS NOT NULL
                  AND l.descricao_norm <> ''
                  AND (:numeroBanco IS NULL OR l.numero_banco = :numeroBanco)
            ),
            totais AS (
                SELECT descricao_norm, numero_banco,
                       MAX(banco_nome) AS banco_nome,
                       MAX(descricao) AS descricao_exemplo,
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
                   t.descricao_exemplo,
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

    private static PadraoRecorrenciaRow mapPadraoRow(Object[] row) {
        PadraoRecorrenciaRow p = new PadraoRecorrenciaRow();
        p.descricaoNorm = row[0] != null ? String.valueOf(row[0]) : "";
        p.numeroBanco = row[1] != null ? ((Number) row[1]).intValue() : null;
        p.bancoNome = row[2] != null ? String.valueOf(row[2]) : null;
        p.descricaoExemplo = row[3] != null ? String.valueOf(row[3]) : null;
        p.ocorrenciasHistorico = row[4] != null ? ((Number) row[4]).longValue() : 0L;
        p.mesesCobertos = row[5] != null ? ((Number) row[5]).longValue() : 0L;
        p.valorMedio = row[6] != null ? new BigDecimal(row[6].toString()) : BigDecimal.ZERO;
        p.contaContabilId = row[7] != null ? ((Number) row[7]).longValue() : null;
        p.cntContaDominante = row[8] != null ? ((Number) row[8]).longValue() : 0L;
        p.qtdPendentes = row[9] != null ? ((Number) row[9]).longValue() : 0L;
        p.contaCodigo = row[10] != null ? String.valueOf(row[10]).trim().toUpperCase() : "";
        p.contaNome = row[11] != null ? String.valueOf(row[11]) : null;
        return p;
    }

    public static final class PadraoRecorrenciaRow {
        public String descricaoNorm;
        public Integer numeroBanco;
        public String bancoNome;
        public String descricaoExemplo;
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
