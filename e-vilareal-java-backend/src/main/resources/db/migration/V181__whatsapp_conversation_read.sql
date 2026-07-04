-- Estado de leitura interno global por conversa (phone_number).

CREATE TABLE whatsapp_conversation_read (
    phone_number VARCHAR(20)  NOT NULL PRIMARY KEY,
    last_read_at TIMESTAMP(3) NOT NULL,
    updated_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Suporta COUNT de INBOUND não lidas por phone_number (subquery correlacionada da lista).
CREATE INDEX idx_whatsapp_phone_direction_created
    ON whatsapp_messages (phone_number, direction, created_at);
