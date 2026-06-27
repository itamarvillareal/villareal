ALTER TABLE contrato_locacao
    ADD COLUMN fiadores_json TEXT NULL COMMENT 'Lista JSON de fiadores: [{"pessoaId":123},...]';
