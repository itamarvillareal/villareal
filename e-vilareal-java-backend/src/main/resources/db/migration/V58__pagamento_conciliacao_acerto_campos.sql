ALTER TABLE pagamento
    ADD COLUMN financeiro_lancamento_id BIGINT NULL AFTER comprovante_arquivo_path,
    ADD COLUMN data_conferencia DATE NULL AFTER data_pagamento_efetivo,
    ADD COLUMN data_acerto DATE NULL AFTER data_conferencia,
    ADD COLUMN valor_pago_banco DECIMAL(19, 2) NULL AFTER valor,
    ADD COLUMN valor_diferenca DECIMAL(19, 2) NULL AFTER valor_pago_banco,
    ADD COLUMN conferido_por_usuario_id BIGINT NULL AFTER responsavel_usuario_id,
    ADD COLUMN mes_referencia VARCHAR(7) NULL AFTER observacoes,
    ADD COLUMN conta_referencia VARCHAR(50) NULL AFTER mes_referencia,
    ADD COLUMN auto_gerado BOOLEAN NOT NULL DEFAULT FALSE AFTER recorrente;

ALTER TABLE pagamento
    ADD CONSTRAINT fk_pag_fin_lancamento FOREIGN KEY (financeiro_lancamento_id)
        REFERENCES financeiro_lancamento (id) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT fk_pag_conferido_por FOREIGN KEY (conferido_por_usuario_id)
        REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX uk_pag_financeiro_lancamento ON pagamento (financeiro_lancamento_id);
