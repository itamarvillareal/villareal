-- Prazos fatais órfãos: cabeçalho sem data, mas linha em processo_prazo ainda marcada como fatal.
-- Alinha com a limpeza feita na tela Processos (relatório consulta ambas as fontes).
UPDATE processo_prazo z
    INNER JOIN processo p ON p.id = z.processo_id
SET z.prazo_fatal = FALSE,
    z.status      = 'CANCELADO'
WHERE z.prazo_fatal = TRUE
  AND p.prazo_fatal IS NULL;
