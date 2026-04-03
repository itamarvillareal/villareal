-- Usuário inicial (desenvolvimento). Login: itamar / Senha: 123456
-- Hash BCrypt ($2a$10$...) compatível com PasswordEncoder do Spring Security.

INSERT INTO pessoa (id, nome, cpf, email, telefone, data_nascimento, ativo, marcado_monitoramento, responsavel_id, created_at, updated_at)
VALUES (1, 'Itamar', '52998224725', 'itamar@vilareal.local', NULL, NULL, TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE pessoa AUTO_INCREMENT = 2;

INSERT INTO usuarios (id, pessoa_id, nome, apelido, login, senha_hash, ativo, created_at, updated_at)
VALUES (1, 1, 'Itamar', 'Itamar', 'itamar', '$2a$10$m2m366PkPAQeHNB4o3uQQ.An0s/NcT097ZikNcRCJXOnFPs2caK.m', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE usuarios AUTO_INCREMENT = 2;

INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (1, 1);
