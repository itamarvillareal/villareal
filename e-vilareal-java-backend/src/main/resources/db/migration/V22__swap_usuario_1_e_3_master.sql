-- O utilizador que era id = 3 (master) passa a ser id = 1; o que era id = 1 passa a id = 3.
-- Id temporário acima do máximo atual evita colisão de PK. Tabelas com FK para usuarios(id)
-- usam ON UPDATE CASCADE (V1–V6), logo perfis, agenda, processos e tarefas acompanham.

SET @swap_tmp := (SELECT COALESCE(MAX(id), 0) + 100000 FROM usuarios u0);

UPDATE usuarios SET id = @swap_tmp WHERE id = 1;
UPDATE usuarios SET id = 1 WHERE id = 3;
UPDATE usuarios SET id = 3 WHERE id = @swap_tmp;
