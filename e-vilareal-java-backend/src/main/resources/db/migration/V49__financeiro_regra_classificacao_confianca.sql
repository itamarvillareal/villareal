ALTER TABLE financeiro_regra_classificacao
    ADD COLUMN confianca DECIMAL(5, 4) NOT NULL DEFAULT 0.8000 AFTER prioridade,
    ADD COLUMN letra_destino CHAR(1) NULL AFTER conta_contabil_id;

UPDATE financeiro_regra_classificacao r
    INNER JOIN financeiro_conta_contabil c ON c.id = r.conta_contabil_id
SET r.letra_destino = UPPER(c.codigo),
    r.confianca = CASE
        WHEN r.prioridade <= 20 THEN 0.9900
        WHEN r.prioridade <= 50 THEN 0.9000
        ELSE 0.8000
    END
WHERE r.letra_destino IS NULL;

CREATE INDEX idx_regra_ativo_confianca ON financeiro_regra_classificacao (ativo, confianca DESC, prioridade);

INSERT INTO financeiro_regra_classificacao (
    padrao_descricao, tipo_match, conta_contabil_id, letra_destino, numero_banco, prioridade, confianca, ativo)
SELECT '%rendimento%', 'CONTAINS', c.id, 'F', NULL, 5, 0.9900, TRUE
FROM financeiro_conta_contabil c
WHERE c.codigo = 'F'
  AND NOT EXISTS (
      SELECT 1 FROM financeiro_regra_classificacao
      WHERE UPPER(padrao_descricao) LIKE '%RENDIMENTO%' AND letra_destino = 'F' AND numero_banco IS NULL
  );

INSERT INTO financeiro_regra_classificacao (
    padrao_descricao, tipo_match, conta_contabil_id, letra_destino, numero_banco, prioridade, confianca, ativo)
SELECT '%deposito judicial%', 'CONTAINS', c.id, 'A', NULL, 5, 0.9900, TRUE
FROM financeiro_conta_contabil c
WHERE c.codigo = 'A'
  AND NOT EXISTS (
      SELECT 1 FROM financeiro_regra_classificacao
      WHERE UPPER(padrao_descricao) LIKE '%DEPOSITO JUDICIAL%' AND letra_destino = 'A'
  );

INSERT INTO financeiro_regra_classificacao (
    padrao_descricao, tipo_match, conta_contabil_id, letra_destino, numero_banco, prioridade, confianca, ativo)
SELECT '%pix transf itamar%', 'CONTAINS', c.id, 'E', NULL, 10, 0.9500, TRUE
FROM financeiro_conta_contabil c
WHERE c.codigo = 'E'
  AND NOT EXISTS (
      SELECT 1 FROM financeiro_regra_classificacao
      WHERE UPPER(padrao_descricao) LIKE '%PIX TRANSF ITAMAR%'
  );

INSERT INTO financeiro_regra_classificacao (
    padrao_descricao, tipo_match, conta_contabil_id, letra_destino, numero_banco, prioridade, confianca, ativo)
SELECT '%pix transf vrv%', 'CONTAINS', c.id, 'E', 1, 15, 0.8000, TRUE
FROM financeiro_conta_contabil c
WHERE c.codigo = 'E'
  AND NOT EXISTS (
      SELECT 1 FROM financeiro_regra_classificacao
      WHERE UPPER(padrao_descricao) LIKE '%PIX TRANSF VRV%' AND numero_banco = 1
  );

INSERT INTO financeiro_regra_classificacao (
    padrao_descricao, tipo_match, conta_contabil_id, letra_destino, numero_banco, prioridade, confianca, ativo)
SELECT '%tarifa cobranca%', 'CONTAINS', c.id, 'A', 4, 15, 0.8000, TRUE
FROM financeiro_conta_contabil c
WHERE c.codigo = 'A'
  AND NOT EXISTS (
      SELECT 1 FROM financeiro_regra_classificacao
      WHERE UPPER(padrao_descricao) LIKE '%TARIFA COBRANCA%' AND numero_banco = 4
  );

INSERT INTO financeiro_regra_classificacao (
    padrao_descricao, tipo_match, conta_contabil_id, letra_destino, numero_banco, prioridade, confianca, ativo)
SELECT '%juros%', 'CONTAINS', c.id, 'F', NULL, 10, 0.9000, TRUE
FROM financeiro_conta_contabil c
WHERE c.codigo = 'F'
  AND NOT EXISTS (
      SELECT 1 FROM financeiro_regra_classificacao
      WHERE UPPER(padrao_descricao) = '%JUROS%' OR UPPER(padrao_descricao) LIKE '%JUROS%'
        AND letra_destino = 'F' AND numero_banco IS NULL
  );
