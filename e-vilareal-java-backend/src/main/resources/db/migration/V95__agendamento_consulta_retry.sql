-- Fase 3 passo 4.1: retry durável — falha não perde a consulta (backoff curto).

ALTER TABLE agendamento_consulta
    ADD COLUMN falhas_consecutivas INT NOT NULL DEFAULT 0,
    ADD COLUMN ultimo_erro TEXT NULL,
    ADD COLUMN ultima_falha_em DATETIME NULL;
