-- Workflow de classificação (distinto de status = soft-delete "ATIVO").
-- Conta N (Não Identificados): id = 5.

ALTER TABLE financeiro_lancamento
    ADD COLUMN etapa VARCHAR(20) NOT NULL DEFAULT 'IMPORTADO';

UPDATE financeiro_lancamento
SET etapa = 'CLASSIFICADO'
WHERE conta_contabil_id != 5;

UPDATE financeiro_lancamento
SET etapa = 'COMPENSADO'
WHERE conta_contabil_id = (SELECT id FROM financeiro_conta_contabil WHERE codigo = 'E')
  AND grupo_compensacao IS NOT NULL
  AND grupo_compensacao != '';

UPDATE financeiro_lancamento
SET etapa = 'VINCULADO'
WHERE conta_contabil_id = (SELECT id FROM financeiro_conta_contabil WHERE codigo = 'A')
  AND cliente_id IS NOT NULL;

CREATE INDEX idx_lancamento_etapa ON financeiro_lancamento (etapa);
CREATE INDEX idx_lancamento_etapa_banco ON financeiro_lancamento (etapa, numero_banco);
CREATE INDEX idx_lancamento_etapa_data ON financeiro_lancamento (etapa, data_lancamento);
