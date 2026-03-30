-- Descrição da ação no cadastro do cliente (espelho semântico de processo.descricao_acao / coluna O da importação)
ALTER TABLE pessoa_complementar
    ADD COLUMN descricao_acao TEXT NULL;
