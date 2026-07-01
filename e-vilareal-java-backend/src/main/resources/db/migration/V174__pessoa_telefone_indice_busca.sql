-- Índice de busca por telefone (dígitos normalizados + sufixo local de 8 dígitos).

SET @db = DATABASE();

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pessoa' AND COLUMN_NAME = 'telefone_digitos') = 0,
    'ALTER TABLE pessoa ADD COLUMN telefone_digitos VARCHAR(20) NULL AFTER telefone, ADD COLUMN telefone_sufixo_8 CHAR(8) NULL AFTER telefone_digitos',
    'SELECT 1'));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pessoa_contato' AND COLUMN_NAME = 'valor_digitos') = 0,
    'ALTER TABLE pessoa_contato ADD COLUMN valor_digitos VARCHAR(20) NULL AFTER valor, ADD COLUMN valor_sufixo_8 CHAR(8) NULL AFTER valor_digitos',
    'SELECT 1'));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE pessoa MODIFY COLUMN telefone_digitos VARCHAR(20) NULL;
ALTER TABLE pessoa_contato MODIFY COLUMN valor_digitos VARCHAR(20) NULL;

UPDATE pessoa
SET telefone_digitos = NULLIF(RIGHT(REGEXP_REPLACE(IFNULL(telefone, ''), '[^0-9]', ''), 20), ''),
    telefone_sufixo_8 = CASE
        WHEN CHAR_LENGTH(REGEXP_REPLACE(IFNULL(telefone, ''), '[^0-9]', '')) >= 8
            THEN RIGHT(REGEXP_REPLACE(IFNULL(telefone, ''), '[^0-9]', ''), 8)
        ELSE NULL
    END
WHERE telefone IS NOT NULL AND TRIM(telefone) <> '';

UPDATE pessoa_contato
SET valor_digitos = NULLIF(RIGHT(REGEXP_REPLACE(IFNULL(valor, ''), '[^0-9]', ''), 20), ''),
    valor_sufixo_8 = CASE
        WHEN CHAR_LENGTH(REGEXP_REPLACE(IFNULL(valor, ''), '[^0-9]', '')) >= 8
            THEN RIGHT(REGEXP_REPLACE(IFNULL(valor, ''), '[^0-9]', ''), 8)
        ELSE NULL
    END
WHERE LOWER(tipo) = 'telefone';

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pessoa' AND INDEX_NAME = 'idx_pessoa_telefone_sufixo_8') = 0,
    'CREATE INDEX idx_pessoa_telefone_sufixo_8 ON pessoa (telefone_sufixo_8)',
    'SELECT 1'));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pessoa' AND INDEX_NAME = 'idx_pessoa_telefone_digitos') = 0,
    'CREATE INDEX idx_pessoa_telefone_digitos ON pessoa (telefone_digitos)',
    'SELECT 1'));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pessoa_contato' AND INDEX_NAME = 'idx_pessoa_contato_valor_sufixo_8') = 0,
    'CREATE INDEX idx_pessoa_contato_valor_sufixo_8 ON pessoa_contato (valor_sufixo_8)',
    'SELECT 1'));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pessoa_contato' AND INDEX_NAME = 'idx_pessoa_contato_valor_digitos') = 0,
    'CREATE INDEX idx_pessoa_contato_valor_digitos ON pessoa_contato (valor_digitos)',
    'SELECT 1'));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
