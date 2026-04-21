-- Torna cpf opcional em pessoa. UNIQUE(cpf) permanece —
-- MySQL/InnoDB aceita multiplos NULL em UNIQUE.
-- Normaliza strings vazias para NULL antes (defensivo).

UPDATE pessoa SET cpf = NULL WHERE cpf = '';

ALTER TABLE pessoa MODIFY COLUMN cpf VARCHAR(14) NULL;
