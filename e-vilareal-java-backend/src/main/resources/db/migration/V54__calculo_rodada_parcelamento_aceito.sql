-- Resumo leve de rodadas: evita parse de payload_json em GET /api/calculos/rodadas/resumo

ALTER TABLE calculo_rodada
    ADD COLUMN parcelamento_aceito TINYINT(1) NOT NULL DEFAULT 0 AFTER dimensao;

UPDATE calculo_rodada
SET parcelamento_aceito = CASE
    WHEN JSON_TYPE(JSON_EXTRACT(payload_json, '$.parcelamentoAceito')) = 'BOOLEAN'
        THEN IF(JSON_EXTRACT(payload_json, '$.parcelamentoAceito') = TRUE, 1, 0)
    WHEN JSON_TYPE(JSON_EXTRACT(payload_json, '$.parcelamentoAceito')) = 'INTEGER'
        THEN IF(JSON_EXTRACT(payload_json, '$.parcelamentoAceito') = 0, 0, 1)
    WHEN LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.parcelamentoAceito')))) IN ('true', '1', 'sim')
        THEN 1
    ELSE 0
END
WHERE payload_json IS NOT NULL;
