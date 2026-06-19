-- Pares de compensação rejeitados pelo utilizador («Não são par») — o greedy ignora e reanalisa.

CREATE TABLE financeiro_compensacao_par_descarte (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    lancamento_id_menor BIGINT NOT NULL,
    lancamento_id_maior BIGINT NOT NULL,
    criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uk_fcpd_par UNIQUE (lancamento_id_menor, lancamento_id_maior),
    CONSTRAINT fk_fcpd_lanc_menor FOREIGN KEY (lancamento_id_menor) REFERENCES financeiro_lancamento (id),
    CONSTRAINT fk_fcpd_lanc_maior FOREIGN KEY (lancamento_id_maior) REFERENCES financeiro_lancamento (id)
);

CREATE INDEX idx_fcpd_lanc_menor ON financeiro_compensacao_par_descarte (lancamento_id_menor);
CREATE INDEX idx_fcpd_lanc_maior ON financeiro_compensacao_par_descarte (lancamento_id_maior);
