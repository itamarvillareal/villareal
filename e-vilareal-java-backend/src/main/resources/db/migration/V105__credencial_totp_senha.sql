-- Senha do 1º fator (PJe) no mesmo cofre TOTP — Base64(IV || ciphertext AES-GCM), nullable.
ALTER TABLE credencial_totp
    ADD COLUMN senha_criptografada VARCHAR(1024) NULL AFTER secret_criptografado;
