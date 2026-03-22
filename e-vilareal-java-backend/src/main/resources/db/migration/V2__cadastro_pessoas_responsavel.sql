-- Vínculo opcional com outra pessoa cadastrada (representante legal, responsável, etc.).
ALTER TABLE cadastro_pessoas
    ADD COLUMN responsavel_id BIGINT NULL COMMENT 'FK para cadastro_pessoas.id (auto-referência)';

CREATE INDEX idx_cadastro_pessoas_responsavel_id ON cadastro_pessoas (responsavel_id);

ALTER TABLE cadastro_pessoas
    ADD CONSTRAINT fk_cadastro_pessoas_responsavel
        FOREIGN KEY (responsavel_id) REFERENCES cadastro_pessoas (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
