-- A migração V52 pode ter reposto `atualizado_em` para o instante da ALTER em todas as linhas.
-- Repõe a data de movimento como referência até haver gravações reais posteriores.
UPDATE processo_andamento
SET atualizado_em = movimento_em,
    criado_em = movimento_em
WHERE atualizado_em >= '2026-05-19 00:00:00'
  AND atualizado_em < '2026-05-20 00:00:00'
  AND movimento_em < '2026-05-19 00:00:00';
