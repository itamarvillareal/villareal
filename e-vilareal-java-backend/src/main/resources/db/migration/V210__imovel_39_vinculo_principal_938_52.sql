-- Imóvel #39 (Veredas do Bosque — Unidade 1003 B): alinhar reconciliação/conta corrente ao vínculo principal 00000938|52.
-- Contrato vigente (39) estava no processo legado 00000722|4 enquanto os pagamentos caíam em 00000938|52.
-- Idempotente / seguro em schema vazio (instâncias novas sem os IDs da Vila Real).

INSERT INTO imovel_vinculo_processo_principal (numero_planilha, codigo_cliente, numero_interno)
VALUES (39, '00000938', 52)
ON DUPLICATE KEY UPDATE
    codigo_cliente = VALUES(codigo_cliente),
    numero_interno = VALUES(numero_interno);

UPDATE contrato_locacao
SET processo_id = 16052
WHERE id = 39
  AND EXISTS (SELECT 1 FROM processo p WHERE p.id = 16052);

UPDATE imovel
SET processo_id = 16052
WHERE id = 17
  AND EXISTS (SELECT 1 FROM processo p WHERE p.id = 16052);

UPDATE imovel_processo
SET ativo = FALSE,
    data_fim = COALESCE(data_fim, CURDATE())
WHERE imovel_id = 17
  AND processo_id = 10474
  AND ativo = TRUE;

INSERT INTO imovel_processo (imovel_id, processo_id, data_inicio, ativo, observacao)
SELECT 17, 16052, CURDATE(), TRUE, 'V210 — sincronizado com vínculo principal 00000938|52'
WHERE EXISTS (SELECT 1 FROM imovel i WHERE i.id = 17)
  AND EXISTS (SELECT 1 FROM processo p WHERE p.id = 16052)
  AND NOT EXISTS (
    SELECT 1 FROM imovel_processo WHERE imovel_id = 17 AND processo_id = 16052
);

UPDATE imovel_processo
SET ativo = TRUE,
    data_fim = NULL,
    observacao = COALESCE(NULLIF(TRIM(observacao), ''), 'V210 — sincronizado com vínculo principal 00000938|52')
WHERE imovel_id = 17
  AND processo_id = 16052;

UPDATE imovel_processo ip
JOIN imovel_processo ip2 ON ip2.imovel_id = ip.imovel_id AND ip2.processo_id = 16052 AND ip2.ativo = TRUE
SET ip.ativo = FALSE,
    ip.data_fim = COALESCE(ip.data_fim, CURDATE())
WHERE ip.imovel_id = 17
  AND ip.processo_id <> 16052
  AND ip.ativo = TRUE;
