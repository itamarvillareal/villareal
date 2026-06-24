-- Vínculo Cod.+Proc. principal por nº da planilha (col. A), escolhido pelo usuário.
CREATE TABLE imovel_vinculo_processo_principal (
    numero_planilha INT NOT NULL PRIMARY KEY,
    codigo_cliente   CHAR(8) NOT NULL,
    numero_interno   INT NOT NULL,
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
