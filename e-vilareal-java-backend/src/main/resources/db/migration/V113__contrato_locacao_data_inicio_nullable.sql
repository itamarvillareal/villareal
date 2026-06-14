-- Data de início de contrato AUSENTE na planilha deve ficar NULL, não o sentinela 2000-01-01.
-- (Decisão de design: 2000-01-01 era um default que poluía vigência/competência; NULL = "sem data na fonte".)
-- A lógica de vigência/competência (IptuApplicationService.intersectaAno) passa a tratar NULL como
-- "contrato sem período definido" e não o inclui no cálculo do ano.

ALTER TABLE contrato_locacao MODIFY COLUMN data_inicio DATE NULL;

-- Migra os contratos que ficaram com o antigo default (sem data real na fonte) para NULL.
UPDATE contrato_locacao SET data_inicio = NULL WHERE data_inicio = '2000-01-01';
