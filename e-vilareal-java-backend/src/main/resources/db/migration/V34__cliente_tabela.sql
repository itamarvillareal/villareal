-- Cadastro de clientes (código 8 dígitos × pessoa), paridade conceitual com `pessoa` + satélites.
-- `codigo_cliente` é único; várias linhas podem apontar para a mesma `pessoa_id` (aliases de import).

CREATE TABLE cliente (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo_cliente CHAR(8) NOT NULL,
    pessoa_id BIGINT NOT NULL,
    nome_referencia VARCHAR(255) NULL,
    documento_referencia VARCHAR(20) NULL,
    observacao TEXT NULL,
    inativo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_cliente_codigo UNIQUE (codigo_cliente),
    CONSTRAINT fk_cliente_pessoa FOREIGN KEY (pessoa_id) REFERENCES pessoa (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_cliente_pessoa ON cliente (pessoa_id);
CREATE INDEX idx_cliente_inativo ON cliente (inativo);

-- 1) Um registro canônico por pessoa: código = LPAD(id, 8, '0')
INSERT INTO cliente (codigo_cliente, pessoa_id)
SELECT LPAD(p.id, 8, '0'), p.id FROM pessoa p;

-- 2) Import Pasta1: normalização só dígitos (leading zeros → valor) alinhada a `PlanilhaPasta1MapeamentoUtil` / `CodigoClienteUtil`
INSERT INTO cliente (codigo_cliente, pessoa_id)
SELECT
    LPAD(
        CAST(
            IF(
                NULLIF(TRIM(LEADING '0' FROM TRIM(BOTH FROM chave_cliente)), '') IS NULL,
                0,
                TRIM(LEADING '0' FROM TRIM(BOTH FROM chave_cliente))
            ) AS UNSIGNED
        ),
        8,
        '0'
    ),
    pessoa_id
FROM planilha_pasta1_cliente
WHERE TRIM(BOTH FROM chave_cliente) REGEXP '^[0-9]+$'
ON DUPLICATE KEY UPDATE
    pessoa_id = VALUES(pessoa_id),
    updated_at = CURRENT_TIMESTAMP;

-- 3) Pessoas sem nenhuma linha em `cliente` (código canônico “tomado” por outra pessoa na etapa 2): fallback 9 + 7 dígitos
INSERT INTO cliente (codigo_cliente, pessoa_id)
SELECT CONCAT('9', LPAD(p.id, 7, '0')), p.id
FROM pessoa p
WHERE NOT EXISTS (SELECT 1 FROM cliente c WHERE c.pessoa_id = p.id);
