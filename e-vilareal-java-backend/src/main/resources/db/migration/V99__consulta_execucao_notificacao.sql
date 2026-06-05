-- Resultado da notificação por e-mail em execuções com novidade (sem backfill).
ALTER TABLE consulta_processo_execucao
    ADD COLUMN notificacao_status VARCHAR(20) NULL,
    ADD COLUMN notificacao_destinatarios TEXT NULL,
    ADD COLUMN notificacao_erro TEXT NULL,
    ADD COLUMN notificacao_em DATETIME NULL;
