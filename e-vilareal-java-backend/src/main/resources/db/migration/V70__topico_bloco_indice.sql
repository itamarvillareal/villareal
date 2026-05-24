ALTER TABLE topico
    ADD COLUMN bloco_indice INT NOT NULL DEFAULT 0 AFTER chave_navegacao;

ALTER TABLE topico
    DROP INDEX uk_topico_chave_navegacao;

ALTER TABLE topico
    ADD UNIQUE KEY uk_topico_chave_bloco (chave_navegacao(400), bloco_indice);
