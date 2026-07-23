-- Campanha idle: cópia progressiva de movimentações (Drive) por cliente, sem concorrer com o robô.

CREATE TABLE copia_movimentacoes_cliente_campanha (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo_cliente CHAR(8) NOT NULL,
    status VARCHAR(30) NOT NULL,
    total_processos INT NOT NULL DEFAULT 0,
    completos INT NOT NULL DEFAULT 0,
    erros INT NOT NULL DEFAULT 0,
    ignorados INT NOT NULL DEFAULT 0,
    iniciada_em DATETIME NOT NULL,
    concluida_em DATETIME NULL,
    email_enviado_em DATETIME NULL,
    atualizado_em DATETIME NOT NULL,
    CONSTRAINT uk_copia_mov_campanha_cliente UNIQUE (codigo_cliente),
    INDEX idx_copia_mov_campanha_status (status)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE copia_movimentacoes_cliente_item (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    campanha_id BIGINT NOT NULL,
    processo_id BIGINT NOT NULL,
    numero_interno INT NULL,
    numero_cnj VARCHAR(40) NULL,
    tramitacao VARCHAR(80) NULL,
    status VARCHAR(30) NOT NULL,
    tem_mais TINYINT(1) NULL,
    tentativas INT NOT NULL DEFAULT 0,
    arquivos_baixados_total INT NOT NULL DEFAULT 0,
    ultima_mensagem TEXT NULL,
    ultima_execucao_em DATETIME NULL,
    concluido_em DATETIME NULL,
    criado_em DATETIME NOT NULL,
    atualizado_em DATETIME NOT NULL,
    CONSTRAINT fk_copia_mov_item_campanha FOREIGN KEY (campanha_id)
        REFERENCES copia_movimentacoes_cliente_campanha (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_copia_mov_item_processo FOREIGN KEY (processo_id)
        REFERENCES processo (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT uk_copia_mov_item_campanha_proc UNIQUE (campanha_id, processo_id),
    INDEX idx_copia_mov_item_status (campanha_id, status),
    INDEX idx_copia_mov_item_processo (processo_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
