ALTER TABLE locacao_repasse_lancamento
    ADD COLUMN rotulo_classificacao VARCHAR(120) NULL AFTER origem;
