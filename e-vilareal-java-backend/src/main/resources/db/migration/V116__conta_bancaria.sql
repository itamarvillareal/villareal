-- Conta bancária como entidade (Fase 3, item 3 — FASE A: expand). Resolve a denormalização de
-- numero_banco/banco_nome em cada financeiro_lancamento e a convenção "real/manual/virtual".
--
-- FASE A é backward-compatible e SEM mudança de comportamento: cria a tabela, semeia a partir dos
-- numero_banco que realmente existem nos dados, adiciona a coluna FK em financeiro_lancamento e a
-- popula. NADA passa a ler conta_bancaria_id ainda (service e frontend seguem por numero_banco) —
-- isso é a FASE B.
--
-- Classificação (só convenção até aqui; agora vira dado):
--   900        -> VIRTUAL, tem_extrato=FALSE (REPASSE INTERNO, sem extrato, fora da conciliação)
--   {9,17,18}  -> MANUAL,  tem_extrato=FALSE (contas de lançamentos manuais, sem extrato)
--   demais     -> REAL,    tem_extrato=TRUE  (contas com extrato bancário)
--
-- IDEMPOTÊNCIA / RE-EXECUTABILIDADE: DDL no MySQL não é transacional, então cada passo é guardado
-- para que, se a migração morrer no meio, o próximo boot complete em vez de travar. MySQL 8 não
-- suporta "ADD COLUMN IF NOT EXISTS", por isso coluna/índice/FK são criados via guarda em
-- information_schema + prepared statement (no-op = DO 0). SEED usa INSERT IGNORE (UK numero_banco)
-- e o backfill é determinístico — re-rodar não duplica nem muda o resultado.
--
-- Rollback:
--   ALTER TABLE financeiro_lancamento DROP FOREIGN KEY fk_fl_conta_bancaria;
--   DROP INDEX idx_fl_conta_bancaria ON financeiro_lancamento;
--   ALTER TABLE financeiro_lancamento DROP COLUMN conta_bancaria_id;
--   DROP TABLE conta_bancaria;

-- (a) Estrutura (idempotente)
CREATE TABLE IF NOT EXISTS conta_bancaria (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    numero_banco INT NOT NULL,
    banco_nome VARCHAR(120) NULL,
    tipo VARCHAR(20) NOT NULL,        -- REAL | MANUAL | VIRTUAL
    tem_extrato BOOLEAN NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_conta_bancaria_numero UNIQUE (numero_banco),
    CONSTRAINT chk_conta_bancaria_tipo CHECK (tipo IN ('REAL', 'MANUAL', 'VIRTUAL'))
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- (b.1) SEED idempotente: um registro por numero_banco DISTINTO existente em financeiro_lancamento ∪
--       financeiro_saldo_inicial (não inventa banco). INSERT IGNORE no UK numero_banco: re-rodar
--       não duplica nem falha. banco_nome é preenchido em (b.2). numero_banco NULL não gera conta.
INSERT IGNORE INTO conta_bancaria (numero_banco, banco_nome, tipo, tem_extrato, ativo)
SELECT
    nb.numero_banco,
    NULL,
    CASE
        WHEN nb.numero_banco = 900 THEN 'VIRTUAL'
        WHEN nb.numero_banco IN (9, 17, 18) THEN 'MANUAL'
        ELSE 'REAL'
    END,
    CASE WHEN nb.numero_banco IN (900, 9, 17, 18) THEN FALSE ELSE TRUE END,
    TRUE
FROM (
    SELECT DISTINCT numero_banco FROM financeiro_lancamento WHERE numero_banco IS NOT NULL
    UNION
    SELECT DISTINCT numero_banco FROM financeiro_saldo_inicial WHERE numero_banco IS NOT NULL
) nb;

-- (b.2) banco_nome canônico = o nome NÃO-NULO mais frequente por numero (somando as duas fontes;
--       empate desfeito alfabeticamente). UPDATE determinístico = idempotente. Derivada
--       não-correlacionada + ROW_NUMBER (MySQL 8).
UPDATE conta_bancaria cb
JOIN (
    SELECT numero_banco, banco_nome FROM (
        SELECT numero_banco, banco_nome,
               ROW_NUMBER() OVER (PARTITION BY numero_banco ORDER BY total DESC, banco_nome ASC) rn
        FROM (
            SELECT numero_banco, banco_nome, SUM(c) total FROM (
                SELECT numero_banco, banco_nome, COUNT(*) c
                FROM financeiro_lancamento
                WHERE numero_banco IS NOT NULL AND banco_nome IS NOT NULL
                GROUP BY numero_banco, banco_nome
                UNION ALL
                SELECT numero_banco, banco_nome, COUNT(*) c
                FROM financeiro_saldo_inicial
                WHERE numero_banco IS NOT NULL AND banco_nome IS NOT NULL
                GROUP BY numero_banco, banco_nome
            ) u
            GROUP BY numero_banco, banco_nome
        ) ranked
    ) m
    WHERE m.rn = 1
) nome ON nome.numero_banco = cb.numero_banco
SET cb.banco_nome = nome.banco_nome;

-- (c) Coluna FK em financeiro_lancamento — criada só se ausente (MySQL 8 não tem ADD COLUMN IF NOT
--     EXISTS). Coluna + índice por Online DDL (INPLACE/LOCK=NONE).
SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'financeiro_lancamento'
      AND column_name = 'conta_bancaria_id');
SET @ddl := IF(@col = 0,
    'ALTER TABLE financeiro_lancamento ADD COLUMN conta_bancaria_id BIGINT NULL, ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'financeiro_lancamento'
      AND index_name = 'idx_fl_conta_bancaria');
SET @ddl := IF(@idx = 0,
    'ALTER TABLE financeiro_lancamento ADD INDEX idx_fl_conta_bancaria (conta_bancaria_id), ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- A FK em si: o MySQL escolhe o melhor algoritmo permitido (a coluna pode estar toda NULL aqui,
-- validação trivial). ON DELETE RESTRICT (conta não some com lançamento apontando) + ON UPDATE CASCADE.
SET @fk := (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'financeiro_lancamento'
      AND constraint_name = 'fk_fl_conta_bancaria' AND constraint_type = 'FOREIGN KEY');
SET @ddl := IF(@fk = 0,
    'ALTER TABLE financeiro_lancamento ADD CONSTRAINT fk_fl_conta_bancaria FOREIGN KEY (conta_bancaria_id) REFERENCES conta_bancaria (id) ON DELETE RESTRICT ON UPDATE CASCADE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- (d) BACKFILL idempotente: liga cada lançamento à sua conta por numero_banco (mesmo valor a cada
--     execução). numero_banco NULL -> FK NULL.
UPDATE financeiro_lancamento fl
JOIN conta_bancaria cb ON cb.numero_banco = fl.numero_banco
SET fl.conta_bancaria_id = cb.id
WHERE fl.numero_banco IS NOT NULL;
