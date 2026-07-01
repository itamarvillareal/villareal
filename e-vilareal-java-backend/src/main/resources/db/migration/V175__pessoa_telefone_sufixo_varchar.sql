-- Hibernate valida VARCHAR; V174 criou sufixo como CHAR(8).
ALTER TABLE pessoa MODIFY COLUMN telefone_sufixo_8 VARCHAR(8) NULL;
ALTER TABLE pessoa_contato MODIFY COLUMN valor_sufixo_8 VARCHAR(8) NULL;
