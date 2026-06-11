-- Segredos TOTP (app autenticador) por tribunal + login — nunca em texto plano.
-- secret_criptografado = Base64(IV_12_bytes || ciphertext_AES_GCM).
CREATE TABLE credencial_totp (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tribunal VARCHAR(40) NOT NULL,
    login VARCHAR(120) NOT NULL,
    secret_criptografado VARCHAR(1024) NOT NULL,
    algoritmo VARCHAR(16) NOT NULL DEFAULT 'SHA1',
    digitos INT NOT NULL DEFAULT 6,
    periodo_segundos INT NOT NULL DEFAULT 30,
    issuer VARCHAR(120) NULL,
    account_name VARCHAR(200) NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uk_credencial_totp_tribunal_login UNIQUE (tribunal, login)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
