-- Endurecimento de schema (Fase 3 — Bloco C, higiene). Adiciona SÓ as invariantes auditadas com
-- 0 violação no DEV e mantidas pelo app (não quebram inserts):
--
--   (1) locacao_repasse_lancamento.valor NOT NULL
--   (2) financeiro_lancamento.etapa   IN ('IMPORTADO','CLASSIFICADO','COMPENSADO','VINCULADO','FECHADO')
--   (3) financeiro_lancamento.natureza IN ('CREDITO','DEBITO')      -- já existe (chk_fl_natureza, V7)
--   (4) financeiro_lancamento.ref_tipo IN ('N','R')                 -- já existe (chk_fl_ref, V7)
--   (5) locacao_repasse_lancamento.papel IN ('ALUGUEL','REPASSE','DESPESA')
--   (6) conta_bancaria.tipo IN ('REAL','MANUAL','VIRTUAL')          -- já existe (chk_conta_bancaria_tipo, V116)
--   (7) locacao_repasse_lancamento.competencia_mes NULL ou AAAA-MM (mês 01–12)
--
-- (3)(4)(6) já estavam no schema desde V7/V116: aqui a guarda detecta e VIRA NO-OP. As novas são
-- (1)(2)(5)(7). A migração declara as 7 invariantes por completude — convergência em qualquer ambiente.
--
-- FORA desta migração (decidido no audit): `origem` (app grava string livre — quebraria origem nova);
-- sentinela 0 de financeiro_recorrencia_descarte (tabela vazia, sem FK/join — só documentado na entity);
-- cartão 1:1 (UK já existe) e EAGER→LAZY (todas as associações já LAZY).
--
-- IDEMPOTÊNCIA / RE-EXECUTABILIDADE: DDL no MySQL 8 não é transacional e não há "ADD CONSTRAINT IF
-- NOT EXISTS"/"MODIFY ... IF". Cada passo é guardado por information_schema + prepared statement
-- (no-op = DO 0). Re-rodar não falha nem duplica.
--
-- Rollback:
--   ALTER TABLE locacao_repasse_lancamento MODIFY COLUMN valor DECIMAL(19,2) NULL;
--   ALTER TABLE financeiro_lancamento DROP CHECK chk_fl_etapa;
--   ALTER TABLE locacao_repasse_lancamento DROP CHECK chk_lrl_papel;
--   ALTER TABLE locacao_repasse_lancamento DROP CHECK chk_lrl_competencia;

-- (1) locacao_repasse_lancamento.valor NOT NULL.
--     App garante não-nulo: criarVinculoComGatilho lança BusinessRuleException se o lançamento não
--     tem valor (e financeiro_lancamento.valor é NOT NULL), e o repasse interno só grava após
--     repasse.signum() > 0. Só altera se a coluna ainda estiver nullable.
SET @nullable := (SELECT is_nullable FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'locacao_repasse_lancamento'
      AND column_name = 'valor');
SET @ddl := IF(@nullable = 'YES',
    'ALTER TABLE locacao_repasse_lancamento MODIFY COLUMN valor DECIMAL(19,2) NOT NULL',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- (2) financeiro_lancamento.etapa — domínio do enum EtapaLancamento (5 valores).
SET @c := (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'financeiro_lancamento'
      AND constraint_name = 'chk_fl_etapa' AND constraint_type = 'CHECK');
SET @ddl := IF(@c = 0,
    'ALTER TABLE financeiro_lancamento ADD CONSTRAINT chk_fl_etapa CHECK (etapa IN (''IMPORTADO'',''CLASSIFICADO'',''COMPENSADO'',''VINCULADO'',''FECHADO''))',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- (3) financeiro_lancamento.natureza — JÁ EXISTE (chk_fl_natureza, V7). Guarda = no-op; declarada p/ completude.
SET @c := (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'financeiro_lancamento'
      AND constraint_name = 'chk_fl_natureza' AND constraint_type = 'CHECK');
SET @ddl := IF(@c = 0,
    'ALTER TABLE financeiro_lancamento ADD CONSTRAINT chk_fl_natureza CHECK (natureza IN (''CREDITO'',''DEBITO''))',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- (4) financeiro_lancamento.ref_tipo — JÁ EXISTE (chk_fl_ref, V7). Guarda = no-op.
SET @c := (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'financeiro_lancamento'
      AND constraint_name = 'chk_fl_ref' AND constraint_type = 'CHECK');
SET @ddl := IF(@c = 0,
    'ALTER TABLE financeiro_lancamento ADD CONSTRAINT chk_fl_ref CHECK (ref_tipo IN (''N'',''R''))',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- (5) locacao_repasse_lancamento.papel — domínio do enum PapelReconciliacao.
SET @c := (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'locacao_repasse_lancamento'
      AND constraint_name = 'chk_lrl_papel' AND constraint_type = 'CHECK');
SET @ddl := IF(@c = 0,
    'ALTER TABLE locacao_repasse_lancamento ADD CONSTRAINT chk_lrl_papel CHECK (papel IN (''ALUGUEL'',''REPASSE'',''DESPESA''))',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- (6) conta_bancaria.tipo — JÁ EXISTE (chk_conta_bancaria_tipo, V116). Guarda = no-op.
SET @c := (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'conta_bancaria'
      AND constraint_name = 'chk_conta_bancaria_tipo' AND constraint_type = 'CHECK');
SET @ddl := IF(@c = 0,
    'ALTER TABLE conta_bancaria ADD CONSTRAINT chk_conta_bancaria_tipo CHECK (tipo IN (''REAL'',''MANUAL'',''VIRTUAL''))',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- (7) locacao_repasse_lancamento.competencia_mes — NULL ou formato AAAA-MM com mês 01–12.
SET @c := (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'locacao_repasse_lancamento'
      AND constraint_name = 'chk_lrl_competencia' AND constraint_type = 'CHECK');
SET @ddl := IF(@c = 0,
    'ALTER TABLE locacao_repasse_lancamento ADD CONSTRAINT chk_lrl_competencia CHECK (competencia_mes IS NULL OR competencia_mes REGEXP ''^[0-9]{4}-(0[1-9]|1[0-2])$'')',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
