-- Assuntos PROJUDI cadastrados pelo usuário (id + descrição), usados em Distribuir Inicial.

CREATE TABLE projudi_assunto_cadastro (
    id_assunto INT NOT NULL PRIMARY KEY COMMENT 'Id_Assunto no PROJUDI',
    descricao VARCHAR(500) NOT NULL,
    criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
