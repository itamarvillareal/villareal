ALTER TABLE whatsapp_messages
    ADD COLUMN deleted_at TIMESTAMP(3) NULL DEFAULT NULL;
