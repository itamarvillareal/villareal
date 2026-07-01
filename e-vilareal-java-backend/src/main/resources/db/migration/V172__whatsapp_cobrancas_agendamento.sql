-- Agendamento de lotes de cobrança WhatsApp (status AGENDADO + horário previsto).
ALTER TABLE whatsapp_cobrancas
    ADD COLUMN scheduled_at TIMESTAMP NULL COMMENT 'Envio programado (Brasília → UTC no app)' AFTER enviado_at;

CREATE INDEX idx_cobranca_agendado ON whatsapp_cobrancas (status, scheduled_at);
