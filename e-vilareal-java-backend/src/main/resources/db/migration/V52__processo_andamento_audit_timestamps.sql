-- Auditoria de gravação/atualização para o relatório Diagnósticos «Consultas Realizadas».
ALTER TABLE processo_andamento
    ADD COLUMN criado_em DATETIME(3) NULL,
    ADD COLUMN atualizado_em DATETIME(3) NULL;

UPDATE processo_andamento
SET criado_em = movimento_em,
    atualizado_em = movimento_em
WHERE criado_em IS NULL;

ALTER TABLE processo_andamento
    MODIFY criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY atualizado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

CREATE INDEX idx_processo_andamento_atualizado_em ON processo_andamento (atualizado_em);
