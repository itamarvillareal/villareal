-- Rastreio por lote (importação de histórico de processos / andamentos).
ALTER TABLE processo_andamento
    ADD COLUMN importacao_id VARCHAR(36) NULL;

CREATE INDEX idx_processo_andamento_importacao_id ON processo_andamento (importacao_id);
