-- Tarefas operacionais (Pendências / Board React: /api/tarefas)

CREATE TABLE tarefa_operacional (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(500) NOT NULL,
    descricao TEXT NULL,
    responsavel_usuario_id BIGINT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDENTE',
    prioridade VARCHAR(32) NOT NULL DEFAULT 'NORMAL',
    data_limite DATE NULL,
    cliente_id BIGINT NULL,
    processo_id BIGINT NULL,
    publicacao_id BIGINT NULL,
    processo_prazo_id BIGINT NULL,
    origem VARCHAR(80) NOT NULL DEFAULT 'BOARD',
    data_conclusao TIMESTAMP(3) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_tarefa_operacional_responsavel FOREIGN KEY (responsavel_usuario_id) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_tarefa_operacional_status CHECK (status IN ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA')),
    CONSTRAINT chk_tarefa_operacional_prioridade CHECK (prioridade IN ('BAIXA', 'NORMAL', 'ALTA', 'URGENTE'))
);

CREATE INDEX idx_tarefa_operacional_responsavel ON tarefa_operacional (responsavel_usuario_id);
CREATE INDEX idx_tarefa_operacional_status ON tarefa_operacional (status);
CREATE INDEX idx_tarefa_operacional_prioridade ON tarefa_operacional (prioridade);
CREATE INDEX idx_tarefa_operacional_data_limite ON tarefa_operacional (data_limite);
CREATE INDEX idx_tarefa_operacional_cliente ON tarefa_operacional (cliente_id);
CREATE INDEX idx_tarefa_operacional_processo ON tarefa_operacional (processo_id);
