-- Foto manual de contato por conversa (telefone canônico), compartilhada entre atendentes.

CREATE TABLE whatsapp_contact_photo (
    phone_number   VARCHAR(20)  NOT NULL PRIMARY KEY,
    drive_file_id  VARCHAR(255) NOT NULL,
    drive_url      VARCHAR(500) NULL,
    updated_at     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
