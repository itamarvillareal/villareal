-- Remove o registro de usuário com id = 4 (agenda e outras FKs: CASCADE ou SET NULL conforme migrações base).
-- processo, processo_andamento e tarefa_operacional com ON DELETE SET NULL).
DELETE FROM usuarios WHERE id = 4;
