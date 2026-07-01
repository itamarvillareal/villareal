-- Índice de busca por telefone (dígitos normalizados + sufixo local de 8 dígitos).

ALTER TABLE pessoa
    ADD COLUMN telefone_digitos VARCHAR(15) NULL AFTER telefone,
    ADD COLUMN telefone_sufixo_8 CHAR(8) NULL AFTER telefone_digitos;

ALTER TABLE pessoa_contato
    ADD COLUMN valor_digitos VARCHAR(15) NULL AFTER valor,
    ADD COLUMN valor_sufixo_8 CHAR(8) NULL AFTER valor_digitos;

UPDATE pessoa
SET telefone_digitos = NULLIF(REGEXP_REPLACE(IFNULL(telefone, ''), '[^0-9]', ''), ''),
    telefone_sufixo_8 = CASE
        WHEN CHAR_LENGTH(REGEXP_REPLACE(IFNULL(telefone, ''), '[^0-9]', '')) >= 8
            THEN RIGHT(REGEXP_REPLACE(IFNULL(telefone, ''), '[^0-9]', ''), 8)
        ELSE NULL
    END
WHERE telefone IS NOT NULL AND TRIM(telefone) <> '';

UPDATE pessoa_contato
SET valor_digitos = NULLIF(REGEXP_REPLACE(IFNULL(valor, ''), '[^0-9]', ''), ''),
    valor_sufixo_8 = CASE
        WHEN CHAR_LENGTH(REGEXP_REPLACE(IFNULL(valor, ''), '[^0-9]', '')) >= 8
            THEN RIGHT(REGEXP_REPLACE(IFNULL(valor, ''), '[^0-9]', ''), 8)
        ELSE NULL
    END
WHERE LOWER(tipo) = 'telefone';

CREATE INDEX idx_pessoa_telefone_sufixo_8 ON pessoa (telefone_sufixo_8);
CREATE INDEX idx_pessoa_telefone_digitos ON pessoa (telefone_digitos);
CREATE INDEX idx_pessoa_contato_valor_sufixo_8 ON pessoa_contato (valor_sufixo_8);
CREATE INDEX idx_pessoa_contato_valor_digitos ON pessoa_contato (valor_digitos);
