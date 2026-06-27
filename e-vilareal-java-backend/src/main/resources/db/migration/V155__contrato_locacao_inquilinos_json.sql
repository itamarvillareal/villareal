ALTER TABLE contrato_locacao
    ADD COLUMN inquilinos_json TEXT NULL COMMENT 'Lista JSON de inquilinos: [{"pessoaId":123},...]';
