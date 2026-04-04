CREATE TABLE agenda_evento (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT NOT NULL,
    data_evento DATE NOT NULL,
    hora_evento VARCHAR(16) NULL,
    descricao VARCHAR(2000) NOT NULL,
    status_curto VARCHAR(8) NULL,
    processo_ref VARCHAR(120) NULL,
    origem VARCHAR(80) NOT NULL DEFAULT 'frontend-agenda',
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_agenda_evento_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_agenda_evento_usuario_data ON agenda_evento (usuario_id, data_evento);
