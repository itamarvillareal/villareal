-- Mapeamento importado da planilha Pasta1: coluna A (chave do cliente) -> pessoa.id (coluna B)

CREATE TABLE planilha_pasta1_cliente (
    chave_cliente VARCHAR(128) NOT NULL,
    pessoa_id BIGINT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (chave_cliente),
    CONSTRAINT fk_planilha_pasta1_pessoa FOREIGN KEY (pessoa_id) REFERENCES pessoa (id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_planilha_pasta1_pessoa ON planilha_pasta1_cliente (pessoa_id);
