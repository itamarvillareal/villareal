ALTER TABLE whatsapp_messages
    ADD COLUMN media_id VARCHAR(255) NULL,
    ADD COLUMN media_mime_type VARCHAR(100) NULL,
    ADD COLUMN media_filename VARCHAR(255) NULL,
    ADD COLUMN media_drive_url VARCHAR(500) NULL;
