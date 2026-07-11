-- Follow-up de cobrança de aluguel: eventos manuais (ligação, anotação, adiamento, resolução manual)
-- por contrato × competência. O restante do estado (mensagens enviadas, resposta do inquilino,
-- pagamento vinculado) é derivado de whatsapp_cobrancas / whatsapp_messages / locacao_repasse_lancamento.
CREATE TABLE aluguel_followup_evento (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contrato_id BIGINT NOT NULL,
    competencia CHAR(7) NOT NULL,
    tipo VARCHAR(20) NOT NULL COMMENT 'LIGACAO, ANOTACAO, ADIAR, RESOLVIDO_MANUAL',
    observacao VARCHAR(500) NULL,
    adiado_ate DATE NULL,
    created_by VARCHAR(100) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_afe_contrato FOREIGN KEY (contrato_id) REFERENCES contrato_locacao (id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_afe_contrato_comp ON aluguel_followup_evento (contrato_id, competencia);
