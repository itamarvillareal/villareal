-- Unidade condominial (independente do vínculo com imóvel) — importação inadimplência / tela Processos.
ALTER TABLE processo
    ADD COLUMN unidade VARCHAR(32) NULL AFTER numero_interno;

CREATE INDEX idx_processo_pessoa_unidade ON processo (pessoa_id, unidade);
