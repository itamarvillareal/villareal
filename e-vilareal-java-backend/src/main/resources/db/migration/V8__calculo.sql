CREATE TABLE calculo_rodada (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo_cliente VARCHAR(8) NOT NULL,
    numero_processo INT NOT NULL,
    dimensao INT NOT NULL DEFAULT 0,
    payload_json JSON NOT NULL,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uk_calculo_rodada_chave UNIQUE (codigo_cliente, numero_processo, dimensao)
);

CREATE INDEX idx_calculo_rodada_cliente ON calculo_rodada (codigo_cliente);

CREATE TABLE calculo_cliente_config (
    codigo_cliente VARCHAR(8) NOT NULL PRIMARY KEY,
    payload_json JSON NOT NULL,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);
