CREATE TABLE auditoria_atividade (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ocorrido_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    usuario_ref VARCHAR(120) NOT NULL,
    usuario_nome VARCHAR(255) NOT NULL,
    modulo VARCHAR(255) NOT NULL,
    tela VARCHAR(500) NOT NULL,
    tipo_acao VARCHAR(80) NOT NULL,
    descricao TEXT NOT NULL,
    registro_afetado_id VARCHAR(120) NULL,
    registro_afetado_nome VARCHAR(500) NULL,
    ip_origem VARCHAR(80) NULL,
    observacoes_tecnicas TEXT NULL
);

CREATE INDEX idx_auditoria_ocorrido ON auditoria_atividade (ocorrido_em DESC);
CREATE INDEX idx_auditoria_usuario_ref ON auditoria_atividade (usuario_ref);
CREATE INDEX idx_auditoria_modulo ON auditoria_atividade (modulo);
CREATE INDEX idx_auditoria_tipo_acao ON auditoria_atividade (tipo_acao);
CREATE INDEX idx_auditoria_registro_id ON auditoria_atividade (registro_afetado_id);
