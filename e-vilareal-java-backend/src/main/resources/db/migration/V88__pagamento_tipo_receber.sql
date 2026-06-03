-- Contas a pagar (PAGAR) + recebíveis/cobranças (RECEBER) na mesma tabela operacional.

ALTER TABLE pagamento
    ADD COLUMN tipo VARCHAR(10) NOT NULL DEFAULT 'PAGAR' AFTER id,
    ADD COLUMN data_emissao DATE NULL AFTER data_cadastro,
    ADD COLUMN data_recebimento DATE NULL AFTER data_pagamento_efetivo,
    ADD COLUMN valor_recebido DECIMAL(19, 2) NULL AFTER valor_pago_banco;

CREATE INDEX idx_pag_tipo_status ON pagamento (tipo, status);
