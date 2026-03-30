-- Garante processo_parte_advogado quando o histórico Flyway em V22 não correspondeu a este DDL (ambientes já em V30+).
-- Idempotente com V22: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS processo_parte_advogado (
    id BIGINT NOT NULL AUTO_INCREMENT,
    processo_parte_id BIGINT NOT NULL,
    advogado_pessoa_id BIGINT NOT NULL,
    ordem INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_processo_parte_advogado (processo_parte_id, advogado_pessoa_id),
    KEY idx_ppa_parte (processo_parte_id),
    CONSTRAINT fk_ppa_parte FOREIGN KEY (processo_parte_id) REFERENCES processo_parte (id) ON DELETE CASCADE,
    CONSTRAINT fk_ppa_advogado FOREIGN KEY (advogado_pessoa_id) REFERENCES pessoa (id)
);
