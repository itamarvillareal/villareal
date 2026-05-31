-- Cofre de credenciais de login no PROJUDI (CPF + senha por advogado).
-- A senha é armazenada SOMENTE cifrada (AES/GCM): `senha_cifrada` = ciphertext+tag,
-- `iv` = nonce de 12 bytes gerado a cada gravação. Nunca em texto plano.
CREATE TABLE projudi_credencial (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT NULL,
    cpf_usuario VARCHAR(14) NOT NULL,
    senha_cifrada VARBINARY(512) NOT NULL,
    iv VARBINARY(32) NOT NULL,
    rotulo VARCHAR(120) NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uk_projudi_credencial_cpf UNIQUE (cpf_usuario)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
