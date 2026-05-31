-- Tipo de usuário (humano vs assistente IA), flag de login humano e cadastro da Júlia.

ALTER TABLE usuarios
    ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'HUMANO' AFTER ativo,
    ADD COLUMN permite_login BOOLEAN NOT NULL DEFAULT TRUE AFTER tipo;

-- Perfil dedicado de menor privilégio para automação/IA (ROLE_ASSISTENTE).
INSERT INTO perfil (id, codigo, nome, descricao, ativo)
SELECT 3, 'ASSISTENTE', 'Assistente IA', 'Automação e IA — sem privilégios administrativos', TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM perfil WHERE codigo = 'ASSISTENTE');

ALTER TABLE perfil AUTO_INCREMENT = 4;

-- Pessoa sintética + usuária Júlia (credencial de serviço; login humano bloqueado).
SET @login_julia := 'julia.assistente';
-- bcrypt de "julia-dev-servico" (12 rounds) — rotacionar em produção
SET @senha_julia := '$2y$12$efrSrCxfnnHJxPiDCw1MMev5hiGUCxpZRx91xcSrnvZzj.4XoH4ge';

INSERT INTO pessoa (nome, cpf, email, telefone, ativo, marcado_monitoramento)
SELECT
    'Júlia (IA)',
    '99999999002',
    'julia.assistente@villarealadvocacia.adv.br',
    NULL,
    TRUE,
    FALSE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE LOWER(login) = @login_julia COLLATE utf8mb4_unicode_ci);

SET @pessoa_julia_id := LAST_INSERT_ID();

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo, tipo, permite_login, perfil_id)
SELECT
    @pessoa_julia_id,
    'Júlia (IA)',
    'JÚLIA',
    @login_julia,
    @senha_julia,
    TRUE,
    'ASSISTENTE_IA',
    FALSE,
    (SELECT id FROM perfil WHERE codigo = 'ASSISTENTE' LIMIT 1)
FROM DUAL
WHERE @pessoa_julia_id > 0
  AND NOT EXISTS (SELECT 1 FROM usuarios WHERE LOWER(login) = @login_julia COLLATE utf8mb4_unicode_ci);
