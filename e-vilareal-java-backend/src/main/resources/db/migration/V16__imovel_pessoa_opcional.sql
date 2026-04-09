-- Imóvel pode existir sem cliente (col. B) / processo (col. C) na planilha; vínculos são opcionais.
ALTER TABLE imovel
    MODIFY COLUMN pessoa_id BIGINT NULL;
