-- Saldo inicial (de abertura) por conta bancária, informado pelo usuário.
--
-- O importador de extratos traz apenas MOVIMENTOS (linhas com data + valor). O saldo de
-- abertura (o saldo que a conta já tinha antes do primeiro lançamento importado) não existe
-- como lançamento. Sem ele, o saldo somado pelo sistema fica defasado em relação ao banco
-- exatamente nesse valor de abertura.
--
-- Esta tabela guarda o saldo de abertura por numero_banco (Nº do consolidado). O cálculo de
-- saldo do banco passa a somar este valor quando a data de referência do cálculo for >=
-- data_referencia.

CREATE TABLE financeiro_saldo_inicial (
    numero_banco    INT            NOT NULL PRIMARY KEY,
    banco_nome      VARCHAR(120)   NULL,
    -- Saldo de abertura é o saldo ao FINAL desta data (véspera do extrato).
    data_referencia DATE           NOT NULL,
    -- Saldo assinado (pode ser negativo).
    valor           DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    criado_em       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
