-- CONTA ZERO — conta extrato única de acertos (clientes, Veredas/Karla, repasses de imóveis próprios).
--
-- Modelo: conta bancária MANUAL numero_banco=19 com regra de soma zero em dois níveis:
--   - nível grupo (bloqueio): todo grupo_compensacao da conta deve somar exatamente 0 e ter o mesmo
--     vínculo (cliente ou pessoa/imóvel) — validado na aplicação;
--   - nível conta (alerta): lançamentos sem grupo são PENDENTES; a UI alerta enquanto a soma ≠ 0.
--
-- Novas colunas:
--   - conta_bancaria.exige_soma_zero: marca contas de acerto (TRUE só para a 19 por ora);
--   - financeiro_lancamento.visivel_cliente: permite omitir parcela do relatório do cliente;
--   - financeiro_lancamento.valor_cliente: permite exibir valor diferente no relatório do cliente.
--
-- IDEMPOTÊNCIA: DDL no MySQL não é transacional; cada passo é guardado via information_schema +
-- prepared statement (no-op = DO 0), no padrão da V116. Seed usa INSERT IGNORE (UK numero_banco).
--
-- Rollback:
--   ALTER TABLE financeiro_lancamento DROP COLUMN visivel_cliente, DROP COLUMN valor_cliente;
--   ALTER TABLE conta_bancaria DROP COLUMN exige_soma_zero;
--   DELETE FROM conta_bancaria WHERE numero_banco = 19;

-- (a) conta_bancaria.exige_soma_zero (guardado)
SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'conta_bancaria'
      AND column_name = 'exige_soma_zero');
SET @ddl := IF(@col = 0,
    'ALTER TABLE conta_bancaria ADD COLUMN exige_soma_zero BOOLEAN NOT NULL DEFAULT FALSE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- (b) Seed da CONTA ZERO (numero_banco 19, MANUAL, sem extrato). INSERT IGNORE + UPDATE
--     determinístico garante o estado final mesmo se a linha já existir por outra origem.
INSERT IGNORE INTO conta_bancaria (numero_banco, banco_nome, tipo, tem_extrato, ativo, exige_soma_zero)
VALUES (19, 'CONTA ZERO', 'MANUAL', FALSE, TRUE, TRUE);

UPDATE conta_bancaria
SET banco_nome = 'CONTA ZERO',
    tipo = 'MANUAL',
    tem_extrato = FALSE,
    ativo = TRUE,
    exige_soma_zero = TRUE
WHERE numero_banco = 19;

-- (c) financeiro_lancamento.visivel_cliente (guardado; INSTANT no MySQL 8)
SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'financeiro_lancamento'
      AND column_name = 'visivel_cliente');
SET @ddl := IF(@col = 0,
    'ALTER TABLE financeiro_lancamento ADD COLUMN visivel_cliente BOOLEAN NOT NULL DEFAULT TRUE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- (d) financeiro_lancamento.valor_cliente (guardado)
SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'financeiro_lancamento'
      AND column_name = 'valor_cliente');
SET @ddl := IF(@col = 0,
    'ALTER TABLE financeiro_lancamento ADD COLUMN valor_cliente DECIMAL(19,2) NULL',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
