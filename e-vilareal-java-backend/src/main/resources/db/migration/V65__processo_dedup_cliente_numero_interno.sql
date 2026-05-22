-- Duplicatas (cliente_id, numero_interno): mantém titular alinhado ao cliente e mais vínculos;
-- reassigna FKs, remove linha redundante e impede nova duplicata.

CREATE TEMPORARY TABLE proc_dedup_ranked AS
SELECT p.id,
       p.cliente_id,
       p.numero_interno,
       ROW_NUMBER() OVER (
           PARTITION BY p.cliente_id, p.numero_interno
           ORDER BY (p.pessoa_id = c.pessoa_id) DESC,
                    (SELECT COUNT(*) FROM processo_parte pp WHERE pp.processo_id = p.id) DESC,
                    (SELECT COUNT(*) FROM financeiro_lancamento fl WHERE fl.processo_id = p.id) DESC,
                    (SELECT COUNT(*) FROM processo_andamento pa WHERE pa.processo_id = p.id) DESC,
                    p.id DESC
       ) AS rn
FROM processo p
INNER JOIN cliente c ON c.id = p.cliente_id;

CREATE TEMPORARY TABLE proc_dedup_keep AS
SELECT cliente_id, numero_interno, id AS keep_id
FROM proc_dedup_ranked
WHERE rn = 1;

CREATE TEMPORARY TABLE proc_dedup_map (
    drop_id BIGINT NOT NULL PRIMARY KEY,
    keep_id BIGINT NOT NULL,
    cliente_id BIGINT NOT NULL,
    numero_interno INT NOT NULL,
    INDEX idx_proc_dedup_keep (keep_id)
);

INSERT INTO proc_dedup_map (drop_id, keep_id, cliente_id, numero_interno)
SELECT d.id, k.keep_id, d.cliente_id, d.numero_interno
FROM proc_dedup_ranked d
INNER JOIN proc_dedup_keep k
    ON k.cliente_id = d.cliente_id
   AND k.numero_interno = d.numero_interno
WHERE d.rn > 1;

UPDATE processo_parte pp
INNER JOIN proc_dedup_map m ON pp.processo_id = m.drop_id
SET pp.processo_id = m.keep_id;

UPDATE processo_andamento pa
INNER JOIN proc_dedup_map m ON pa.processo_id = m.drop_id
SET pa.processo_id = m.keep_id;

UPDATE processo_prazo pz
INNER JOIN proc_dedup_map m ON pz.processo_id = m.drop_id
SET pz.processo_id = m.keep_id;

UPDATE imovel i
INNER JOIN proc_dedup_map m ON i.processo_id = m.drop_id
SET i.processo_id = m.keep_id;

UPDATE financeiro_lancamento fl
INNER JOIN proc_dedup_map m ON fl.processo_id = m.drop_id
SET fl.processo_id = m.keep_id;

UPDATE financeiro_lancamento_cartao flc
INNER JOIN proc_dedup_map m ON flc.processo_id = m.drop_id
SET flc.processo_id = m.keep_id;

UPDATE pagamento pg
INNER JOIN proc_dedup_map m ON pg.processo_id = m.drop_id
SET pg.processo_id = m.keep_id;

UPDATE tarefa_operacional t
INNER JOIN proc_dedup_map m ON t.processo_id = m.drop_id
SET t.processo_id = m.keep_id;

UPDATE publicacoes pub
INNER JOIN proc_dedup_map m ON pub.processo_id = m.drop_id
SET pub.processo_id = m.keep_id;

UPDATE financeiro_regra_classificacao frc
INNER JOIN proc_dedup_map m ON frc.processo_id = m.drop_id
SET frc.processo_id = m.keep_id;

DELETE p FROM processo p
INNER JOIN proc_dedup_map m ON p.id = m.drop_id;

DROP TEMPORARY TABLE proc_dedup_ranked;
DROP TEMPORARY TABLE proc_dedup_keep;
DROP TEMPORARY TABLE proc_dedup_map;
