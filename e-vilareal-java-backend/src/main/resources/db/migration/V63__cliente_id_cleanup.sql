-- V63 (Fase 5B): NOT NULL cliente em processo, UK (cliente_id, numero_interno), drop legado publicações, log temporário.
-- processo.pessoa_id permanece (titular/sujeito).
-- pessoa_ref_id no financeiro: manter coluna até confirmação final (DROP comentado abaixo).

ALTER TABLE processo
    MODIFY cliente_id BIGINT NOT NULL;

ALTER TABLE processo
    DROP INDEX uk_processo_pessoa_numero;

ALTER TABLE processo
    ADD CONSTRAINT uk_processo_cliente_numero UNIQUE (cliente_id, numero_interno);

DROP INDEX idx_publicacoes_cliente_ref ON publicacoes;

ALTER TABLE publicacoes
    DROP COLUMN cliente_ref_id;

-- ALTER TABLE financeiro_lancamento DROP COLUMN pessoa_ref_id;
-- ALTER TABLE financeiro_lancamento_cartao DROP COLUMN pessoa_ref_id;
-- ALTER TABLE financeiro_regra_classificacao DROP COLUMN pessoa_ref_id;

DROP TABLE IF EXISTS migracao_cliente_log;
