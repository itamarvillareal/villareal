-- Usuário de teste para QA automatizado (Playwright). Perfil USUARIO (id=2), sem ADMIN.
-- Idempotente: não altera nada se o login marina.teste já existir.

SET @login_marina := 'marina.teste';
SET @senha_marina := '$2y$12$/OciWbWZorveZrE4XxRGyO8UlqWudIlIbD3fWX3Hm.KgGu/uywFtG';

INSERT INTO pessoa (nome, cpf, email, telefone, ativo, marcado_monitoramento)
SELECT
    'Marina Teste (QA Automatizado)',
    '99999999001',
    'marina.teste.qa@villarealadvocacia.adv.br',
    NULL,
    TRUE,
    FALSE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE LOWER(login) = @login_marina);

SET @pessoa_marina_id := LAST_INSERT_ID();

INSERT INTO usuarios (pessoa_id, nome, apelido, login, senha_hash, ativo, perfil_id)
SELECT
    @pessoa_marina_id,
    'Marina Teste (QA Automatizado)',
    'MARINA',
    @login_marina,
    @senha_marina,
    TRUE,
    2
FROM DUAL
WHERE @pessoa_marina_id > 0
  AND NOT EXISTS (SELECT 1 FROM usuarios WHERE LOWER(login) = @login_marina);
