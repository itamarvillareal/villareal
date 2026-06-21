-- Repasse de honorários sobre alvará (espelha locacao_repasse_lancamento, domínio processual).
-- Liga contrato_honorarios aos lançamentos reais do caixa (financeiro_lancamento).

CREATE TABLE honorario_repasse_lancamento (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contrato_honorarios_id BIGINT NOT NULL,
    lancamento_financeiro_id BIGINT NOT NULL,
    papel VARCHAR(20) NOT NULL,
    data_referencia DATE NULL,
    valor DECIMAL(19, 2) NOT NULL,
    alvara_vinculo_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_hrl_contrato FOREIGN KEY (contrato_honorarios_id) REFERENCES contrato_honorarios (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_hrl_lancamento FOREIGN KEY (lancamento_financeiro_id) REFERENCES financeiro_lancamento (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_hrl_alvara_vinculo FOREIGN KEY (alvara_vinculo_id) REFERENCES honorario_repasse_lancamento (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_hrl_contrato_lancamento_papel UNIQUE (contrato_honorarios_id, lancamento_financeiro_id, papel)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_hrl_contrato ON honorario_repasse_lancamento (contrato_honorarios_id);
CREATE INDEX idx_hrl_lancamento ON honorario_repasse_lancamento (lancamento_financeiro_id);
CREATE INDEX idx_hrl_alvara_vinculo ON honorario_repasse_lancamento (alvara_vinculo_id);
