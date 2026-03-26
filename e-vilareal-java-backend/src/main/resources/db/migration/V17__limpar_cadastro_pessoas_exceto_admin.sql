-- Remove todos os cadastros de pessoa exceto id=1 (bootstrap V2: administrador).
-- Zera vínculos financeiros e de tarefas a clientes removidos; remove processos das pessoas excluídas;
-- remove usuários secundários (id > 1), pois cada um referencia uma pessoa.

UPDATE pessoa SET responsavel_id = NULL WHERE responsavel_id > 1;

UPDATE financeiro_lancamento SET cliente_id = NULL WHERE cliente_id IS NOT NULL AND cliente_id > 1;

UPDATE tarefa_operacional SET cliente_id = NULL WHERE cliente_id IS NOT NULL AND cliente_id > 1;

DELETE pp FROM processo_prazo pp
         INNER JOIN processo p ON p.id = pp.processo_id
WHERE p.pessoa_id > 1;

DELETE pa FROM processo_andamento pa
         INNER JOIN processo p ON p.id = pa.processo_id
WHERE p.pessoa_id > 1;

DELETE ppart FROM processo_parte ppart
         INNER JOIN processo p ON p.id = ppart.processo_id
WHERE p.pessoa_id > 1;

DELETE FROM processo WHERE pessoa_id > 1;

DELETE FROM usuario_perfil WHERE usuario_id > 1;

DELETE FROM usuarios WHERE id > 1;

DELETE FROM pessoa WHERE id > 1;

ALTER TABLE usuarios AUTO_INCREMENT = 2;
ALTER TABLE pessoa AUTO_INCREMENT = 2;
