-- Fonte única imóvel↔processo (Fase 3, item 4 — FASE A: expand).
--
-- A linha ATIVA de imovel_processo passa a ser a fonte única; o escalar imovel.processo_id vira
-- espelho sincronizado (some na FASE C). O audit encontrou 5 imóveis (13/19/22/26/32 no DEV) com
-- escalar não-nulo SEM nenhuma linha em imovel_processo (carga anterior ao link service; a seed do
-- V67 só copiou o que existia então). Este backfill fecha essa divergência: depois dele, todo escalar
-- não-nulo tem uma linha ATIVA correspondente, e ler do N:N dá o mesmo resultado do escalar.
--
-- Invariante de sincronização: o escalar é sempre derivado da linha ativa mais recente (LinkService),
-- então "escalar não-nulo X com linha ativa Y≠X" é impossível — logo todo divergente tem ZERO linha
-- ativa e inserir uma linha ativa para o par do escalar não cria um segundo ativo (mantém 1-ativo).
--
-- IDEMPOTÊNCIA: INSERT ... SELECT com NOT EXISTS no par (imovel_id, processo_id) — re-rodar não
-- duplica (e o UK uk_imovel_processo é a rede de segurança). Determinístico.
--
-- Rollback: não há (apenas insere linhas espelhando dados já existentes no escalar).

INSERT INTO imovel_processo (imovel_id, processo_id, data_inicio, ativo)
SELECT i.id, i.processo_id, NULL, TRUE
FROM imovel i
WHERE i.processo_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM imovel_processo ip
      WHERE ip.imovel_id = i.id AND ip.processo_id = i.processo_id
  );
