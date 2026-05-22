CREATE TABLE prestacao_contas_pagamento (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    prestacao_contas_id BIGINT NOT NULL,
    pagamento_id BIGINT NOT NULL,
    criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_pcp_prestacao FOREIGN KEY (prestacao_contas_id) REFERENCES prestacao_contas (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_pcp_pagamento FOREIGN KEY (pagamento_id) REFERENCES pagamento (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT uk_pcp_pagamento UNIQUE (pagamento_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE pagamento
    ADD COLUMN prestacao_contas_id BIGINT NULL AFTER conferido_por_usuario_id,
    ADD CONSTRAINT fk_pag_prestacao_contas FOREIGN KEY (prestacao_contas_id)
        REFERENCES prestacao_contas (id) ON DELETE SET NULL ON UPDATE CASCADE;
