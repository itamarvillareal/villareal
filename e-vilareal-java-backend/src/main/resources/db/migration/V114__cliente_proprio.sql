-- Flag de "imóvel próprio" no cadastro de cliente (Fase 3, item 1 — resolve C6/A11).
-- Antes a detecção era hardcoded em CODIGOS_CLIENTE_PROPRIO {00000938, 00000149} no
-- LocacaoReconciliacaoService, com a pegadinha de que o código 149 mapeia para cliente.id 151.
-- A fonte da verdade passa a ser este flag, semeado por codigo_cliente (NUNCA por id) — o que
-- resolve a pegadinha 149->id 151 por si só.
--
-- Backward-compatible: default FALSE + seed garantem que o comportamento atual não muda
-- (VRV 00000938 e Itamar 00000149 seguem próprios; imóvel 43 continua próprio).
--
-- Rollback: ALTER TABLE cliente DROP COLUMN proprio;

ALTER TABLE cliente ADD COLUMN proprio BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE cliente SET proprio = TRUE WHERE codigo_cliente IN ('00000938', '00000149');
