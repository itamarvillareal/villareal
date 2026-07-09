ALTER TABLE cliente
    ADD COLUMN usuario_responsavel_padrao_id BIGINT NULL,
    ADD CONSTRAINT fk_cliente_usuario_resp_padrao
        FOREIGN KEY (usuario_responsavel_padrao_id) REFERENCES usuarios (id)
        ON DELETE SET NULL;
