-- Fase 3 passo 1: baseline de movimentações PROJUDI já vistas por processo (dedup por id_movi).

CREATE TABLE movimentacao_monitorada (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    processo_id BIGINT NOT NULL,
    id_movi VARCHAR(64) NOT NULL,
    numero INT NULL,
    legenda VARCHAR(1000) NULL,
    data_movimentacao DATETIME NULL,
    data_consulta DATETIME NOT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_movimonitorada_processo FOREIGN KEY (processo_id) REFERENCES processo (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT uk_movimonitorada_proc_movi UNIQUE (processo_id, id_movi),
    INDEX idx_movimonitorada_processo (processo_id),
    INDEX idx_movimonitorada_data_consulta (data_consulta)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
