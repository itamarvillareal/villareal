CREATE TABLE publicacoes_tratamentos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    publicacao_id BIGINT NOT NULL,
    status_anterior VARCHAR(30) NULL,
    status_novo VARCHAR(30) NOT NULL,
    acao VARCHAR(40) NOT NULL,
    descricao VARCHAR(500) NULL,
    processo_id BIGINT NULL,
    cliente_id BIGINT NULL,
    usuario_id BIGINT NULL,
    andamento_gerado BOOLEAN NOT NULL DEFAULT FALSE,
    prazo_gerado BOOLEAN NOT NULL DEFAULT FALSE,
    tarefa_gerada BOOLEAN NOT NULL DEFAULT FALSE,
    metadados_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pub_trat_publicacao FOREIGN KEY (publicacao_id) REFERENCES publicacoes (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_pub_trat_processo FOREIGN KEY (processo_id) REFERENCES processos (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_pub_trat_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_pub_trat_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX idx_pub_trat_publicacao ON publicacoes_tratamentos (publicacao_id, created_at DESC);
CREATE INDEX idx_pub_trat_status ON publicacoes_tratamentos (status_novo);
CREATE INDEX idx_pub_trat_acao ON publicacoes_tratamentos (acao);
CREATE INDEX idx_pub_trat_usuario ON publicacoes_tratamentos (usuario_id);
