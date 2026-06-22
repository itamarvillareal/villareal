-- Varredura FILTRADA por CONTA (1:1, inclui 5 proc excluidos antes). DRY-RUN.
-- Lançamentos: 28 | Processos: 5
-- Aplicar via: python3 opcao_a_contas.py --apply-conta
START TRANSACTION;
UPDATE financeiro_lancamento SET imovel_id = 12 WHERE id = 216199 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 5360
UPDATE financeiro_lancamento SET imovel_id = 12 WHERE id = 216201 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 5360
UPDATE financeiro_lancamento SET imovel_id = 12 WHERE id = 166265 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 5360
UPDATE financeiro_lancamento SET imovel_id = 12 WHERE id = 166266 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 5360
UPDATE financeiro_lancamento SET imovel_id = 12 WHERE id = 166267 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 5360
UPDATE financeiro_lancamento SET imovel_id = 12 WHERE id = 166268 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 5360
UPDATE financeiro_lancamento SET imovel_id = 12 WHERE id = 166269 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 5360
UPDATE financeiro_lancamento SET imovel_id = 12 WHERE id = 166270 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 5360
UPDATE financeiro_lancamento SET imovel_id = 12 WHERE id = 166271 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 5360
UPDATE financeiro_lancamento SET imovel_id = 12 WHERE id = 166272 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 5360
UPDATE financeiro_lancamento SET imovel_id = 12 WHERE id = 166273 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 5360
UPDATE financeiro_lancamento SET imovel_id = 12 WHERE id = 166274 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 5360
UPDATE financeiro_lancamento SET imovel_id = 12 WHERE id = 166276 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 5360
UPDATE financeiro_lancamento SET imovel_id = 12 WHERE id = 166278 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 5360
UPDATE financeiro_lancamento SET imovel_id = 12 WHERE id = 197863 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 5360
UPDATE financeiro_lancamento SET imovel_id = 21 WHERE id = 166011 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 13051
UPDATE financeiro_lancamento SET imovel_id = 21 WHERE id = 216268 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 13051
UPDATE financeiro_lancamento SET imovel_id = 21 WHERE id = 216269 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 13051
UPDATE financeiro_lancamento SET imovel_id = 28 WHERE id = 190741 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 13300
UPDATE financeiro_lancamento SET imovel_id = 85 WHERE id = 167659 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 1865
UPDATE financeiro_lancamento SET imovel_id = 85 WHERE id = 167660 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 1865
UPDATE financeiro_lancamento SET imovel_id = 85 WHERE id = 167661 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 1865
UPDATE financeiro_lancamento SET imovel_id = 85 WHERE id = 167662 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 1865
UPDATE financeiro_lancamento SET imovel_id = 85 WHERE id = 167663 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 1865
UPDATE financeiro_lancamento SET imovel_id = 85 WHERE id = 167664 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 1865
UPDATE financeiro_lancamento SET imovel_id = 85 WHERE id = 167666 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 1865
UPDATE financeiro_lancamento SET imovel_id = 85 WHERE id = 200881 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 1865
UPDATE financeiro_lancamento SET imovel_id = 99 WHERE id = 190490 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- proc 12799
-- COMMIT;
