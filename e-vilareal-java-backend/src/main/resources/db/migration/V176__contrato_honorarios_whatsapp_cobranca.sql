-- Cobrança WhatsApp de honorários (vencimento de parcelas) + rastreio por pagamento.

ALTER TABLE contrato_honorarios
    ADD COLUMN whatsapp_cobranca_ativo TINYINT(1) NOT NULL DEFAULT 0 AFTER forma_pagamento_parcelas,
    ADD COLUMN whatsapp_cobranca_horario VARCHAR(5) NOT NULL DEFAULT '09:00' AFTER whatsapp_cobranca_ativo,
    ADD COLUMN whatsapp_cobranca_antecedencia VARCHAR(24) NOT NULL DEFAULT 'VENCIMENTO_DIA' AFTER whatsapp_cobranca_horario,
    ADD COLUMN whatsapp_cobranca_telefones_extras TEXT NULL AFTER whatsapp_cobranca_antecedencia;

ALTER TABLE scheduled_whatsapp_messages
    ADD COLUMN pagamento_id BIGINT NULL AFTER processo_id,
    ADD INDEX idx_scheduled_whatsapp_pagamento (pagamento_id, template_name, status);
