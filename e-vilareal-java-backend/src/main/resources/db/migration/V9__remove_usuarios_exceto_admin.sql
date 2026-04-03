-- Mantém apenas o usuário do bootstrap (V2: id=1, login itamar).
-- usuario_perfil e agenda_evento: CASCADE; processo, processo_andamento, tarefa_operacional: SET NULL.

DELETE FROM usuarios WHERE id <> 1;

ALTER TABLE usuarios AUTO_INCREMENT = 2;
