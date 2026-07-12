-- Etapa 6 imóveis: opt-in por contrato para cobrança WhatsApp agendada no vencimento.
ALTER TABLE contrato_locacao
    ADD COLUMN agendar_cobranca_whatsapp TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'Opt-in: agendar cobrança WhatsApp no dia de vencimento do aluguel';
