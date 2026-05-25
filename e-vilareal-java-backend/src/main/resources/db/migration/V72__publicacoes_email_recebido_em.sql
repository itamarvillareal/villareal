-- Data/hora de recebimento do email Gmail (internalDate) na importação MONITORAMENTO.
ALTER TABLE publicacoes
    ADD COLUMN email_recebido_em TIMESTAMP(3) NULL COMMENT 'Recebimento do email Jusbrasil no Gmail' AFTER arquivo_origem_hash;

CREATE INDEX idx_publicacoes_email_recebido ON publicacoes (email_recebido_em);
