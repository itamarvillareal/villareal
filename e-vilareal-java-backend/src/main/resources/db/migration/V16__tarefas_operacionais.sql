-- Fase 8: tarefas operacionais (workflow pragmático) + histórico simples de mudança de status

CREATE TABLE tarefas_operacionais (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(500) NOT NULL,
    descricao TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',
    prioridade VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    origem VARCHAR(40) NOT NULL DEFAULT 'MANUAL' COMMENT 'MANUAL, PUBLICACAO, PRAZO, AGENDA, OUTRO — preparação para automações futuras',
    responsavel_usuario_id BIGINT NULL,
    criador_usuario_id BIGINT NULL,
    cliente_id BIGINT NULL,
    processo_id BIGINT NULL,
    publicacao_id BIGINT NULL,
    agenda_evento_id BIGINT NULL,
    processo_prazo_id BIGINT NULL,
    data_limite DATE NULL,
    data_conclusao DATETIME NULL,
    observacao_conclusao TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_tarefas_responsavel FOREIGN KEY (responsavel_usuario_id) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_tarefas_criador FOREIGN KEY (criador_usuario_id) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_tarefas_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_tarefas_processo FOREIGN KEY (processo_id) REFERENCES processos (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_tarefas_publicacao FOREIGN KEY (publicacao_id) REFERENCES publicacoes (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_tarefas_agenda FOREIGN KEY (agenda_evento_id) REFERENCES agenda_eventos (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_tarefas_prazo FOREIGN KEY (processo_prazo_id) REFERENCES processo_prazos (id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX idx_tarefas_responsavel ON tarefas_operacionais (responsavel_usuario_id);
CREATE INDEX idx_tarefas_status ON tarefas_operacionais (status);
CREATE INDEX idx_tarefas_prioridade ON tarefas_operacionais (prioridade);
CREATE INDEX idx_tarefas_origem ON tarefas_operacionais (origem);
CREATE INDEX idx_tarefas_cliente ON tarefas_operacionais (cliente_id);
CREATE INDEX idx_tarefas_processo ON tarefas_operacionais (processo_id);
CREATE INDEX idx_tarefas_publicacao ON tarefas_operacionais (publicacao_id);
CREATE INDEX idx_tarefas_data_limite ON tarefas_operacionais (data_limite);
CREATE INDEX idx_tarefas_criador ON tarefas_operacionais (criador_usuario_id);

CREATE TABLE tarefa_operacional_historico (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tarefa_id BIGINT NOT NULL,
    usuario_id BIGINT NULL,
    tipo VARCHAR(30) NOT NULL DEFAULT 'STATUS_ALTERADO',
    status_anterior VARCHAR(30) NULL,
    status_novo VARCHAR(30) NULL,
    detalhe TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tarefa_hist_tarefa FOREIGN KEY (tarefa_id) REFERENCES tarefas_operacionais (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_tarefa_hist_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX idx_tarefa_hist_tarefa ON tarefa_operacional_historico (tarefa_id);
CREATE INDEX idx_tarefa_hist_created ON tarefa_operacional_historico (created_at);
