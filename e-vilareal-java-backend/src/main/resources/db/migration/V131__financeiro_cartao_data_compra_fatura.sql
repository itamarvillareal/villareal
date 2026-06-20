-- Corrige ano da data da compra em lançamentos importados de fatura de cartão
-- (Excel BTG grava 30/12 como 2026-12-30 quando o vencimento é em janeiro/2026).
UPDATE financeiro_lancamento_cartao
SET data_lancamento = DATE(CONCAT(
        CASE
            WHEN MONTH(data_lancamento) > MONTH(data_competencia) THEN YEAR(data_competencia) - 1
            ELSE YEAR(data_competencia)
        END,
        '-',
        LPAD(MONTH(data_lancamento), 2, '0'),
        '-',
        LPAD(DAY(data_lancamento), 2, '0')
    ))
WHERE origem LIKE 'FATURA_%'
  AND data_competencia IS NOT NULL
  AND data_lancamento IS NOT NULL
  AND YEAR(data_lancamento) <> CASE
        WHEN MONTH(data_lancamento) > MONTH(data_competencia) THEN YEAR(data_competencia) - 1
        ELSE YEAR(data_competencia)
    END;
