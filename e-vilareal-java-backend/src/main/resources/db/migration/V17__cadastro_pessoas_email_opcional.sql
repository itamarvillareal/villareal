-- E-mail passa a ser opcional; UNIQUE permite vários NULL no MySQL.
ALTER TABLE cadastro_pessoas
    MODIFY COLUMN email VARCHAR(255) NULL COMMENT 'Opcional; único quando informado';
