-- Vínculos quebrados: processo_id aponta para processo inexistente (ex.: remoção legada).
UPDATE publicacoes pub
LEFT JOIN processo p ON p.id = pub.processo_id
SET pub.processo_id = NULL
WHERE pub.processo_id IS NOT NULL
  AND p.id IS NULL;
