-- Rastreio por lote de importação (reversão condomínio PDF / planilha XLS).

ALTER TABLE processo
    ADD COLUMN importacao_id VARCHAR(36) NULL AFTER unidade;

CREATE INDEX idx_processo_importacao_id ON processo (importacao_id);

ALTER TABLE processo_parte
    ADD COLUMN importacao_id VARCHAR(36) NULL AFTER ordem;

CREATE INDEX idx_processo_parte_importacao_id ON processo_parte (importacao_id);

ALTER TABLE calculo_rodada
    ADD COLUMN importacao_id VARCHAR(36) NULL AFTER dimensao;

CREATE INDEX idx_calculo_rodada_importacao_id ON calculo_rodada (importacao_id);

ALTER TABLE pessoa
    ADD COLUMN importacao_id VARCHAR(36) NULL AFTER marcado_monitoramento;

CREATE INDEX idx_pessoa_importacao_id ON pessoa (importacao_id);

ALTER TABLE pessoa_contato
    ADD COLUMN importacao_id VARCHAR(36) NULL AFTER valor;

CREATE INDEX idx_pessoa_contato_importacao_id ON pessoa_contato (importacao_id);

ALTER TABLE pessoa_endereco
    ADD COLUMN importacao_id VARCHAR(36) NULL AFTER complemento;

CREATE INDEX idx_pessoa_endereco_importacao_id ON pessoa_endereco (importacao_id);
