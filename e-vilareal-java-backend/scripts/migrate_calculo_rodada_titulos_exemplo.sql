-- Exemplo manual (MySQL 8): só a 1ª parcela → 1º título.
-- Migração completa e idempotente: use a migração Flyway Java V27__BackfillCalculoTitulosFromParcelas.
--
-- UPDATE calculo_rodada
-- SET payload_json = JSON_SET(
--     payload_json,
--     '$.titulos[0].dataVencimento', JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.parcelas[0].dataVencimento')),
--     '$.titulos[0].valorInicial', JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.parcelas[0].valorParcela'))
-- )
-- WHERE JSON_LENGTH(JSON_EXTRACT(payload_json, '$.parcelas')) > 0
--   AND (
--     JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.titulos[0].valorInicial')) IS NULL
--     OR JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.titulos[0].valorInicial')) = ''
--   );

SELECT 1 AS usar_migracao_java_V27;
