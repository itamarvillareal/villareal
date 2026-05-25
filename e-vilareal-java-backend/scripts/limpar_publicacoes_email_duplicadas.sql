-- Remove duplicatas de importação Gmail (MONITORAMENTO): mantém o registro mais antigo
-- por par (número do processo, data de publicação).
-- Execute no MySQL após backup, ex.: mysql -u root -p vilareal < scripts/limpar_publicacoes_email_duplicadas.sql

DELETE p
FROM publicacoes p
INNER JOIN (
    SELECT UPPER(numero_processo_encontrado) AS num,
           data_publicacao AS dt,
           MIN(id) AS id_manter
    FROM publicacoes
    WHERE origem_importacao = 'MONITORAMENTO'
    GROUP BY UPPER(numero_processo_encontrado), data_publicacao
    HAVING COUNT(*) > 1
) dup
    ON UPPER(p.numero_processo_encontrado) = dup.num
   AND (p.data_publicacao <=> dup.dt)
   AND p.origem_importacao = 'MONITORAMENTO'
   AND p.id <> dup.id_manter;
