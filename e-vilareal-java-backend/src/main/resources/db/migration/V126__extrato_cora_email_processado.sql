-- E-mails Gmail de extrato Cora já importados (deduplicação sem depender de lido/não lido).
CREATE TABLE extrato_cora_email_processado (
    gmail_message_id VARCHAR(64) NOT NULL,
    gmail_user VARCHAR(255) NOT NULL,
    processado_em TIMESTAMP(6) NOT NULL,
    lancamentos_criados INT NOT NULL DEFAULT 0,
    lancamentos_ja_existiam INT NOT NULL DEFAULT 0,
    falhas INT NOT NULL DEFAULT 0,
    PRIMARY KEY (gmail_message_id, gmail_user)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
