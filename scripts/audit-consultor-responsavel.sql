-- Auditoria pré-backfill: valores reais de consultor em produção.
-- Rodar via scripts/audit-consultor-responsavel.sh (túnel VPS ou dump restaurado).

SELECT '--- Totais ---' AS secao;
SELECT COUNT(*) AS total_processos FROM processo;
SELECT COUNT(*) AS com_consultor
FROM processo
WHERE consultor IS NOT NULL AND TRIM(consultor) <> '';
SELECT COUNT(*) AS com_usuario_responsavel_id
FROM processo
WHERE usuario_responsavel_id IS NOT NULL;

SELECT '--- DISTINCT consultor (ordenado) ---' AS secao;
SELECT DISTINCT TRIM(consultor) AS consultor
FROM processo
WHERE consultor IS NOT NULL AND TRIM(consultor) <> ''
ORDER BY 1;

SELECT '--- Frequência por consultor ---' AS secao;
SELECT TRIM(consultor) AS consultor, COUNT(*) AS qtd
FROM processo
WHERE consultor IS NOT NULL AND TRIM(consultor) <> ''
GROUP BY TRIM(consultor)
ORDER BY qtd DESC, consultor;

SELECT '--- Match exato login (humanos ativos) ---' AS secao;
SELECT TRIM(p.consultor) AS consultor, u.id AS usuario_id, u.login, COUNT(*) AS qtd_processos
FROM processo p
JOIN usuarios u ON u.ativo = 1 AND u.tipo = 'HUMANO'
  AND LOWER(TRIM(p.consultor)) = LOWER(TRIM(u.login))
WHERE p.consultor IS NOT NULL AND TRIM(p.consultor) <> ''
  AND p.usuario_responsavel_id IS NULL
GROUP BY TRIM(p.consultor), u.id, u.login
ORDER BY qtd_processos DESC;

SELECT '--- Consultores sem match login/apelido único (candidatos a NULL no backfill) ---' AS secao;
SELECT TRIM(p.consultor) AS consultor, COUNT(*) AS qtd
FROM processo p
WHERE p.consultor IS NOT NULL AND TRIM(p.consultor) <> ''
  AND p.usuario_responsavel_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.ativo = 1 AND u.tipo = 'HUMANO'
      AND LOWER(TRIM(p.consultor)) = LOWER(TRIM(u.login))
  )
  AND (
    SELECT COUNT(*) FROM usuarios u2
    WHERE u2.ativo = 1 AND u2.tipo = 'HUMANO'
      AND u2.apelido IS NOT NULL
      AND TRIM(u2.apelido) <> ''
      AND LOWER(TRIM(p.consultor)) = LOWER(TRIM(u2.apelido))
  ) <> 1
GROUP BY TRIM(p.consultor)
ORDER BY qtd DESC, consultor;

SELECT '--- Colaboradores humanos ativos (referência) ---' AS secao;
SELECT id, login, apelido, tipo, ativo
FROM usuarios
WHERE ativo = 1 AND tipo = 'HUMANO'
ORDER BY id;
