-- Tribunal e grau PJe por processo (tramitação continua sendo o seletor de sistema).
ALTER TABLE processo
    ADD COLUMN pje_tribunal VARCHAR(32) NULL,
    ADD COLUMN pje_grau VARCHAR(20) NULL;

-- Legado: todo processo já marcado como PJe passa a TRT18 + 1º grau (idempotente).
UPDATE processo
SET pje_tribunal = 'PJE_TRT18',
    pje_grau = 'PRIMEIRO_GRAU'
WHERE UPPER(TRIM(tramitacao)) = 'PJE';
