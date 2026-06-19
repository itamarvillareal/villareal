-- Sugestões da aba Escritório (Inbox) rejeitadas pelo utilizador.

CREATE TABLE financeiro_semelhante_escritorio_descarte (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    lancamento_id BIGINT NOT NULL,
    cliente_id BIGINT NOT NULL,
    processo_id BIGINT NOT NULL,
    criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uk_fsed_sugestao UNIQUE (lancamento_id, cliente_id, processo_id),
    CONSTRAINT fk_fsed_lanc FOREIGN KEY (lancamento_id) REFERENCES financeiro_lancamento (id)
);

CREATE INDEX idx_fsed_lancamento ON financeiro_semelhante_escritorio_descarte (lancamento_id);
