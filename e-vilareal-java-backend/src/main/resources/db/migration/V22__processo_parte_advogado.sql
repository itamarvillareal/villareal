-- Advogados vinculados a cada linha de processo_parte (pessoa da parte pode ter vários advogados; advogado = pessoa).

CREATE TABLE processo_parte_advogado (
    id BIGINT NOT NULL AUTO_INCREMENT,
    processo_parte_id BIGINT NOT NULL,
    advogado_pessoa_id BIGINT NOT NULL,
    ordem INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_processo_parte_advogado (processo_parte_id, advogado_pessoa_id),
    CONSTRAINT fk_ppa_parte FOREIGN KEY (processo_parte_id) REFERENCES processo_parte (id) ON DELETE CASCADE,
    CONSTRAINT fk_ppa_advogado FOREIGN KEY (advogado_pessoa_id) REFERENCES pessoa (id)
);

CREATE INDEX idx_ppa_parte ON processo_parte_advogado (processo_parte_id);
