-- Assuntos do catálogo fixo ocultados pelo usuário (não aparecem na lista).

CREATE TABLE projudi_assunto_oculto (
    id_assunto INT NOT NULL PRIMARY KEY COMMENT 'Id_Assunto no PROJUDI',
    ocultado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
