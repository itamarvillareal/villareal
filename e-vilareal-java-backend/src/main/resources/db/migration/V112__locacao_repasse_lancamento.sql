-- Backbone de reconciliação do financeiro de imóveis (Fase A).
-- Liga o ciclo de locação (aluguel/repasse/despesa) aos lançamentos reais do caixa
-- (financeiro_lancamento). Um ciclo tem mais de um lançamento e pode ser parcelado,
-- por isso a relação é N:N e não a FK única antiga (locacao_repasse.lancamento_financeiro_vinculo_id
-- e locacao_despesa.lancamento_financeiro_id permanecem por compatibilidade, mas o cálculo
-- passa a usar esta tabela).

CREATE TABLE locacao_repasse_lancamento (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contrato_locacao_id BIGINT NOT NULL,
    competencia_mes VARCHAR(7) NULL,
    lancamento_financeiro_id BIGINT NOT NULL,
    papel VARCHAR(20) NOT NULL, -- ALUGUEL | REPASSE | DESPESA
    valor DECIMAL(19, 2) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_lrl_contrato FOREIGN KEY (contrato_locacao_id) REFERENCES contrato_locacao (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_lrl_lancamento FOREIGN KEY (lancamento_financeiro_id) REFERENCES financeiro_lancamento (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    -- Idempotência: um mesmo lançamento não se repete no mesmo papel dentro do contrato.
    CONSTRAINT uk_lrl_contrato_lancamento_papel UNIQUE (contrato_locacao_id, lancamento_financeiro_id, papel)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_lrl_contrato_competencia ON locacao_repasse_lancamento (contrato_locacao_id, competencia_mes);
CREATE INDEX idx_lrl_lancamento ON locacao_repasse_lancamento (lancamento_financeiro_id);

-- (E) Taxa de administração como parâmetro do contrato (EXPECTATIVA; o realizado vem dos vínculos).
ALTER TABLE contrato_locacao
    ADD COLUMN taxa_administracao_percent DECIMAL(5, 2) NOT NULL DEFAULT 10.00;
