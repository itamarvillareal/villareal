-- Senha padrão de desenvolvimento: 123456 (BCrypt) para todos os usuários existentes.

UPDATE usuarios
SET senha_hash = '$2a$10$m2m366PkPAQeHNB4o3uQQ.An0s/NcT097ZikNcRCJXOnFPs2caK.m',
    updated_at = CURRENT_TIMESTAMP;
