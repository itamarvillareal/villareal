-- Séries mensais de índices econômicos (SGS/BCB) persistidas para os Cálculos.
-- Uma linha por (índice, competência); só grava competências efetivamente publicadas.
CREATE TABLE calculo_indice_mensal (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    indice VARCHAR(16) NOT NULL,
    competencia CHAR(7) NOT NULL COMMENT 'yyyy-MM',
    valor DECIMAL(12, 6) NOT NULL COMMENT 'variação/rentabilidade mensal em %',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_calculo_indice_mensal UNIQUE (indice, competencia)
);
