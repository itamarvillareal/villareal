-- Consulta periódica PROJUDI (Fase 2.1): agendamentos e histórico de execuções.

CREATE TABLE agendamento_consulta (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    processo_id BIGINT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    tipo_cadencia VARCHAR(20) NOT NULL,
    intervalo_minutos INT NULL,
    horarios_fixos VARCHAR(255) NULL,
    janela_inicio TIME NULL,
    janela_fim TIME NULL,
    apenas_dias_uteis BOOLEAN NOT NULL DEFAULT FALSE,
    considerar_feriados BOOLEAN NOT NULL DEFAULT FALSE,
    proxima_execucao DATETIME NULL,
    ultima_execucao DATETIME NULL,
    valido_ate DATETIME NULL,
    prioridade INT NOT NULL DEFAULT 0,
    motivo VARCHAR(255) NULL,
    criado_por VARCHAR(100) NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_agendamento_consulta_processo FOREIGN KEY (processo_id) REFERENCES processo (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_agendamento_consulta_processo (processo_id),
    INDEX idx_agendamento_consulta_ativo_proxima (ativo, proxima_execucao)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE consulta_processo_execucao (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    processo_id BIGINT NOT NULL,
    agendamento_id BIGINT NULL,
    origem VARCHAR(20) NOT NULL,
    iniciada_em DATETIME NOT NULL,
    finalizada_em DATETIME NULL,
    duracao_ms BIGINT NULL,
    status VARCHAR(30) NOT NULL,
    teores_novos INT NOT NULL DEFAULT 0,
    teores_ja_existentes INT NOT NULL DEFAULT 0,
    arquivos_baixados INT NOT NULL DEFAULT 0,
    erro TEXT NULL,
    detalhes TEXT NULL,
    CONSTRAINT fk_consulta_execucao_processo FOREIGN KEY (processo_id) REFERENCES processo (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_consulta_execucao_agendamento FOREIGN KEY (agendamento_id) REFERENCES agendamento_consulta (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_consulta_execucao_processo_iniciada (processo_id, iniciada_em),
    INDEX idx_consulta_execucao_agendamento (agendamento_id),
    INDEX idx_consulta_execucao_status (status)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
