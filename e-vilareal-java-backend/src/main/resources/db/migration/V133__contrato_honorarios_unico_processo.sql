-- Um contrato de honorários vigente por processo (contratação atual, não histórico de PDFs).

DELETE chp
FROM contrato_honorarios_parcela chp
INNER JOIN contrato_honorarios c ON c.id = chp.contrato_honorarios_id
INNER JOIN contrato_honorarios c2 ON c.processo_id = c2.processo_id AND c.id < c2.id
WHERE c.processo_id IS NOT NULL;

DELETE c
FROM contrato_honorarios c
INNER JOIN contrato_honorarios c2 ON c.processo_id = c2.processo_id AND c.id < c2.id
WHERE c.processo_id IS NOT NULL;

ALTER TABLE contrato_honorarios
    ADD COLUMN atualizado_em TIMESTAMP(6) NULL AFTER criado_em;

CREATE UNIQUE INDEX uk_contrato_honorarios_processo ON contrato_honorarios (processo_id);
