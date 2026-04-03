-- Bases legadas podem ter ficado com login "admin" após repair Flyway sem reexecutar V2.
-- Garante o utilizador bootstrap id=1 com login itamar e senha 123456 (mesmo hash da V18).

UPDATE usuarios
SET login = 'itamar',
    nome = 'Itamar',
    apelido = 'Itamar',
    senha_hash = '$2a$10$m2m366PkPAQeHNB4o3uQQ.An0s/NcT097ZikNcRCJXOnFPs2caK.m',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1;

UPDATE pessoa
SET nome = 'Itamar',
    email = 'itamar@vilareal.local',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1;
