-- Cofre de credenciais de login no PJe (usuário + senha cifrada).
CREATE TABLE pje_credencial (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tribunal VARCHAR(40) NOT NULL,
    login VARCHAR(120) NOT NULL,
    senha_cifrada VARBINARY(512) NOT NULL,
    iv VARBINARY(32) NOT NULL,
    rotulo VARCHAR(120) NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uk_pje_credencial_tribunal_login UNIQUE (tribunal, login)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
