-- Vincula o usuário id = 3 à pessoa 868 (Cadastro de Pessoas).
-- Libera 868 na constraint uk_usuarios_pessoa: quem tinha 868 passa a usar a pessoa que o usuário 3 tinha.
UPDATE usuarios u_blocker
    INNER JOIN usuarios u3 ON u3.id = 3
SET u_blocker.pessoa_id = u3.pessoa_id
WHERE u_blocker.pessoa_id = 868
  AND u_blocker.id <> 3;

UPDATE usuarios u
    INNER JOIN pessoa p ON p.id = 868
SET u.pessoa_id = p.id,
    u.nome    = p.nome
WHERE u.id = 3;
