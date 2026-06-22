-- Vínculo imóvel <- financeiro_lancamento (revise antes de aplicar).
-- Alvo: financeiro_lancamento.imovel_id
-- Auto ALTA/MÉDIA: 49 | Manual: 6 | Total: 55
-- Duplicatas NÃO vinculadas: ver vinculo_duplicatas.csv
START TRANSACTION;
UPDATE financeiro_lancamento SET imovel_id = 8 WHERE id = 177535 AND imovel_id IS NULL;  -- [AUTO] F-18 / água / 113.02 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 8 WHERE id = 179994 AND imovel_id IS NULL;  -- [AUTO] F-18 / água / 112.58 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 8 WHERE id = 180161 AND imovel_id IS NULL;  -- [AUTO] F-18 / água / 110.00 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 8 WHERE id = 180355 AND imovel_id IS NULL;  -- [AUTO] F-18 / água / 115.30 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 8 WHERE id = 219745 AND imovel_id IS NULL;  -- [AUTO] F-18 / água / 136.42 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 8 WHERE id = 180087 AND imovel_id IS NULL;  -- [AUTO] F-18 / energia / 127.04 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 8 WHERE id = 180088 AND imovel_id IS NULL;  -- [AUTO] F-18 / energia / 119.27 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 8 WHERE id = 180285 AND imovel_id IS NULL;  -- [AUTO] F-18 / energia / 135.91 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 8 WHERE id = 219786 AND imovel_id IS NULL;  -- [AUTO] F-18 / energia / 130.12 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 8 WHERE id = 211330 AND imovel_id IS NULL;  -- [AUTO] F-18 / energia / 131.85 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 72 WHERE id = 177385 AND imovel_id IS NULL;  -- [AUTO] 404 04 São José / condomínio / 268.42 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 72 WHERE id = 179820 AND imovel_id IS NULL;  -- [AUTO] 404 04 São José / condomínio / 268.42 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 72 WHERE id = 180163 AND imovel_id IS NULL;  -- [AUTO] 404 04 São José / condomínio / 268.42 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 72 WHERE id = 177418 AND imovel_id IS NULL;  -- [AUTO] 404 04 São José / energia / 53.21 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 72 WHERE id = 177644 AND imovel_id IS NULL;  -- [AUTO] 404 04 São José / energia / 54.61 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 71 WHERE id = 177476 AND imovel_id IS NULL;  -- [AUTO] Executive Privê / condomínio / 883.13 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 71 WHERE id = 179947 AND imovel_id IS NULL;  -- [AUTO] Executive Privê / condomínio / 883.13 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 71 WHERE id = 180103 AND imovel_id IS NULL;  -- [AUTO] Executive Privê / condomínio / 883.13 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 71 WHERE id = 180462 AND imovel_id IS NULL;  -- [AUTO] Executive Privê / condomínio / 780.00 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 71 WHERE id = 211336 AND imovel_id IS NULL;  -- [AUTO] Executive Privê / condomínio / 780.00 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 65 WHERE id = 177480 AND imovel_id IS NULL;  -- [AUTO] 505 A / energia / 110.08 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 65 WHERE id = 179881 AND imovel_id IS NULL;  -- [AUTO] 505 A / energia / 240.31 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 65 WHERE id = 180036 AND imovel_id IS NULL;  -- [AUTO] 505 A / energia / 75.52 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 65 WHERE id = 179948 AND imovel_id IS NULL;  -- [AUTO] 505 A / condomínio / 294.56 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 65 WHERE id = 210203 AND imovel_id IS NULL;  -- [AUTO] 505 A / condomínio / 294.56 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 65 WHERE id = 180305 AND imovel_id IS NULL;  -- [AUTO] 505 A / condomínio / 294.56 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 65 WHERE id = 180465 AND imovel_id IS NULL;  -- [AUTO] 505 A / condomínio / 294.56 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 65 WHERE id = 211333 AND imovel_id IS NULL;  -- [AUTO] 505 A / condomínio / 295.56 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 65 WHERE id = 177576 AND imovel_id IS NULL;  -- [AUTO] 505 A / água / 60.65 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 65 WHERE id = 179884 AND imovel_id IS NULL;  -- [AUTO] 505 A / água / 139.07 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 65 WHERE id = 180360 AND imovel_id IS NULL;  -- [AUTO] 505 A / água / 79.17 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 65 WHERE id = 211350 AND imovel_id IS NULL;  -- [AUTO] 505 A / água / 62.94 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 65 WHERE id = 180134 AND imovel_id IS NULL;  -- [AUTO] 505 A / gás / 6.68 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 65 WHERE id = 211351 AND imovel_id IS NULL;  -- [AUTO] 505 A / gás / 6.93 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 70 WHERE id = 177482 AND imovel_id IS NULL;  -- [AUTO] 101 C / condomínio / 253.95 / ALTA
UPDATE financeiro_lancamento SET imovel_id = 70 WHERE id = 180101 AND imovel_id IS NULL;  -- [AUTO] 101 C / condomínio / 253.95 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 70 WHERE id = 180306 AND imovel_id IS NULL;  -- [AUTO] 101 C / condomínio / 253.95 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 70 WHERE id = 180463 AND imovel_id IS NULL;  -- [AUTO] 101 C / condomínio / 253.95 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 70 WHERE id = 211332 AND imovel_id IS NULL;  -- [AUTO] 101 C / condomínio / 253.95 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 70 WHERE id = 179883 AND imovel_id IS NULL;  -- [AUTO] 101 C / água / 96.47 / ALTA
UPDATE financeiro_lancamento SET imovel_id = 70 WHERE id = 180038 AND imovel_id IS NULL;  -- [AUTO] 101 C / água / 82.65 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 70 WHERE id = 180229 AND imovel_id IS NULL;  -- [AUTO] 101 C / água / 82.65 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 70 WHERE id = 180135 AND imovel_id IS NULL;  -- [AUTO] 101 C / gás / 12.03 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 70 WHERE id = 180347 AND imovel_id IS NULL;  -- [AUTO] 101 C / gás / 7.80 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 70 WHERE id = 219751 AND imovel_id IS NULL;  -- [AUTO] 101 C / gás / 5.61 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 70 WHERE id = 211340 AND imovel_id IS NULL;  -- [AUTO] 101 C / gás / 7.15 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 73 WHERE id = 180317 AND imovel_id IS NULL;  -- [AUTO] 1101 C Veredas / condomínio / 293.59 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 73 WHERE id = 180222 AND imovel_id IS NULL;  -- [AUTO] 1101 C Veredas / energia / 65.72 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 73 WHERE id = 180400 AND imovel_id IS NULL;  -- [AUTO] 1101 C Veredas / energia / 61.80 / MEDIA
UPDATE financeiro_lancamento SET imovel_id = 72 WHERE id = 180353 AND imovel_id IS NULL;  -- [MANUAL] 404 São José cond R$308,68 — CONFLITO resolvido
UPDATE financeiro_lancamento SET imovel_id = 65 WHERE id = 177436 AND imovel_id IS NULL;  -- [MANUAL] 505 A água SANEAGO (não vincular 177417 SISPAG)
UPDATE financeiro_lancamento SET imovel_id = 65 WHERE id = 180037 AND imovel_id IS NULL;  -- [MANUAL] 505 A água R$16,65
UPDATE financeiro_lancamento SET imovel_id = 70 WHERE id = 180419 AND imovel_id IS NULL;  -- [MANUAL] 101 C água R$17,46
UPDATE financeiro_lancamento SET imovel_id = 73 WHERE id = 180151 AND imovel_id IS NULL;  -- [MANUAL] 1101 C gás nov/2025
UPDATE financeiro_lancamento SET imovel_id = 73 WHERE id = 180152 AND imovel_id IS NULL;  -- [MANUAL] 1101 C gás fev/2026
COMMIT;
