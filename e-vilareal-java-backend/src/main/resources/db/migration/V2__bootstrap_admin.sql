-- Usuário inicial para primeiro acesso (desenvolvimento). Login: admin / Senha: password
-- Hash BCrypt ($2a$10$...) compatível com PasswordEncoder do Spring Security.

INSERT INTO pessoa (id, nome, cpf, email, telefone, data_nascimento, ativo, marcado_monitoramento, responsavel_id, created_at, updated_at)
VALUES (1, 'Administrador', '52998224725', 'admin@vilareal.local', NULL, NULL, TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE pessoa AUTO_INCREMENT = 2;

INSERT INTO usuarios (id, pessoa_id, nome, apelido, login, senha_hash, ativo, created_at, updated_at)
VALUES (1, 1, 'Administrador', 'Admin', 'admin', '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE usuarios AUTO_INCREMENT = 2;

INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (1, 1);
