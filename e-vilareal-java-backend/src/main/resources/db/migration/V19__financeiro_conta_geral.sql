-- Conta contábil «Geral» (código G): visão consolidada de todos os lançamentos no front;
-- não altera lançamentos existentes nem remove contas anteriores.
INSERT INTO financeiro_conta_contabil (codigo, nome, ativo, ordem_exibicao)
VALUES ('G', 'Geral', TRUE, 130);
