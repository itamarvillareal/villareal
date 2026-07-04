-- Status de download/upload de mídia WhatsApp (Meta → Drive) + metadados de retry.

ALTER TABLE whatsapp_messages
    ADD COLUMN media_status VARCHAR(20) NULL,
    ADD COLUMN media_download_attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN media_last_attempt_at TIMESTAMP(3) NULL,
    ADD COLUMN media_error VARCHAR(500) NULL;

-- Mídia já no Drive
UPDATE whatsapp_messages
SET media_status = 'DONE'
WHERE media_drive_url IS NOT NULL;

-- Mídia aguardando upload (ou falha ainda não classificada)
UPDATE whatsapp_messages
SET media_status = 'PENDING'
WHERE media_id IS NOT NULL
  AND media_drive_url IS NULL;

-- Índice para job de reprocessamento: filtra por status e ordena por antiguidade
CREATE INDEX idx_whatsapp_messages_media_status_created
    ON whatsapp_messages (media_status, created_at);
