-- Um perfil por utilizador: coluna perfil_id; remove a tabela N:N usuario_perfil.
-- Quem tinha vários perfis fica com o de menor id (ex.: ADMIN 1 vence USUARIO 2).

ALTER TABLE usuarios
    ADD COLUMN perfil_id BIGINT NULL AFTER ativo;

UPDATE usuarios u
    LEFT JOIN (
        SELECT usuario_id, MIN(perfil_id) AS pid
        FROM usuario_perfil
        GROUP BY usuario_id
    ) x ON x.usuario_id = u.id
SET u.perfil_id = COALESCE(x.pid, 2);

UPDATE usuarios
SET perfil_id = 2
WHERE perfil_id IS NULL;

ALTER TABLE usuarios
    MODIFY perfil_id BIGINT NOT NULL,
    ADD CONSTRAINT fk_usuarios_perfil FOREIGN KEY (perfil_id) REFERENCES perfil (id)
        ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE usuario_perfil;
