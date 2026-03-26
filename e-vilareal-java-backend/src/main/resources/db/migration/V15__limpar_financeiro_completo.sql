-- Remove todos os dados do módulo financeiro (lançamentos e plano de contas).
-- Reinsere o plano de contas padrão definido em V11__financeiro.sql para manter códigos/nomes esperados pela API e testes.

DELETE FROM financeiro_lancamento;

DELETE FROM financeiro_conta_contabil;

ALTER TABLE financeiro_lancamento AUTO_INCREMENT = 1;
ALTER TABLE financeiro_conta_contabil AUTO_INCREMENT = 1;

INSERT INTO financeiro_conta_contabil (codigo, nome, ativo, ordem_exibicao) VALUES
    ('A', 'Conta Escritório', TRUE, 10),
    ('B', 'Conta Trabalhos Extras', TRUE, 20),
    ('C', 'Conta Pessoal', TRUE, 30),
    ('D', 'Conta Veredas', TRUE, 40),
    ('N', 'Conta Não Identificados', TRUE, 50),
    ('E', 'Conta Compensação', TRUE, 60),
    ('F', 'Conta Fundos Investimentos', TRUE, 70),
    ('M', 'Conta Marcenaria', TRUE, 80),
    ('R', 'Conta Rachel', TRUE, 90),
    ('P', 'Conta Pessoa Jurídica', TRUE, 100),
    ('I', 'Conta Imóveis', TRUE, 110),
    ('J', 'Conta Julio', TRUE, 120);
