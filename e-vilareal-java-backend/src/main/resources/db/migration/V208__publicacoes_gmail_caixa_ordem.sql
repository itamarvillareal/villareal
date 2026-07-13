-- Posição na caixa Gmail (query Projudi+TRT): menor = mais recente no topo da inbox.
ALTER TABLE publicacoes
    ADD COLUMN gmail_caixa_ordem INT NULL COMMENT 'Ordem na caixa Gmail (0 = topo)' AFTER email_recebido_em;

CREATE INDEX idx_publicacoes_gmail_caixa_ordem ON publicacoes (gmail_caixa_ordem);
