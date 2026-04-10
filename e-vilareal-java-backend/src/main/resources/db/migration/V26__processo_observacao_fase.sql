-- Observação de fase (planilha «Dados complementares processos», col. K); UI faseCampo.
ALTER TABLE processo
    ADD COLUMN observacao_fase TEXT NULL AFTER fase;
