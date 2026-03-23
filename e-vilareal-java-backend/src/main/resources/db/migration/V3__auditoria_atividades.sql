-- Log de auditoria / atividades do sistema (consulta e rastreabilidade).
CREATE TABLE IF NOT EXISTS auditoria_atividades (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id VARCHAR(64) NOT NULL,
    usuario_nome VARCHAR(255) NOT NULL,
    ocorrido_em DATETIME(6) NOT NULL,
    modulo VARCHAR(128) NOT NULL,
    tela VARCHAR(512),
    tipo_acao VARCHAR(64) NOT NULL,
    descricao TEXT NOT NULL,
    registro_afetado_id VARCHAR(64),
    registro_afetado_nome VARCHAR(512),
    ip_origem VARCHAR(64),
    observacoes_tecnicas TEXT,
    INDEX idx_aud_ocorrido_em (ocorrido_em),
    INDEX idx_aud_usuario_id (usuario_id),
    INDEX idx_aud_modulo (modulo),
    INDEX idx_aud_tipo_acao (tipo_acao)
);
