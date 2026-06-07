-- DRY-RUN: contagens antes de aplicar V100 na VPS (não altera dados).
-- Rodar contra dump ou réplica: mysql -u... -p vilareal < verificacao_v100.sql

SELECT 'total_atual_habilitada_1' AS metrica,
       COUNT(*) AS valor
FROM processo
WHERE consulta_periodica_habilitada = 1;

SELECT 'seriam_zerados' AS metrica,
       COUNT(*) AS valor
FROM processo p
WHERE p.consulta_periodica_habilitada = 1
  AND NOT EXISTS (SELECT 1 FROM agendamento_consulta a WHERE a.processo_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM notificacao_destinatario n WHERE n.processo_id = p.id);

SELECT 'seriam_mantidos' AS metrica,
       COUNT(*) AS valor
FROM processo p
WHERE p.consulta_periodica_habilitada = 1
  AND (
      EXISTS (SELECT 1 FROM agendamento_consulta a WHERE a.processo_id = p.id)
      OR EXISTS (SELECT 1 FROM notificacao_destinatario n WHERE n.processo_id = p.id)
  );
