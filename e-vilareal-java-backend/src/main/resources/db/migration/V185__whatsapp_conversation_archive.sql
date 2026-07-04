-- Estado de arquivamento global por conversa (phone_number), compartilhado entre atendentes.

CREATE TABLE whatsapp_conversation_archive (
    phone_number VARCHAR(20)  NOT NULL PRIMARY KEY,
    archived_at  TIMESTAMP(3) NOT NULL,
    updated_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
