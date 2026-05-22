CREATE TABLE imovel_processo (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    imovel_id BIGINT NOT NULL,
    processo_id BIGINT NOT NULL,
    data_inicio DATE NULL,
    data_fim DATE NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    observacao VARCHAR(500) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_ip_imovel FOREIGN KEY (imovel_id) REFERENCES imovel (id),
    CONSTRAINT fk_ip_processo FOREIGN KEY (processo_id) REFERENCES processo (id),
    CONSTRAINT uk_imovel_processo UNIQUE (imovel_id, processo_id)
);

CREATE INDEX idx_ip_imovel ON imovel_processo (imovel_id);
CREATE INDEX idx_ip_processo ON imovel_processo (processo_id);
CREATE INDEX idx_ip_imovel_ativo ON imovel_processo (imovel_id, ativo);

INSERT INTO imovel_processo (imovel_id, processo_id, ativo)
SELECT id, processo_id, TRUE
FROM imovel
WHERE processo_id IS NOT NULL;

ALTER TABLE imovel DROP INDEX uk_imovel_numero_planilha;

ALTER TABLE imovel
    ADD CONSTRAINT uk_imovel_cliente_numero_planilha UNIQUE (cliente_id, numero_planilha);
