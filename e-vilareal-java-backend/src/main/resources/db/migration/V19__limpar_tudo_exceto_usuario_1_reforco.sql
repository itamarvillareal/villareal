-- Repete a limpeza operacional (idempotente): remove novamente tudo exceto usuario id=1 e pessoa id=1.
-- Inclui remoção explícita de filhos de pessoa e de perfis de usuários secundários antes dos DELETE principais.

DELETE FROM financeiro_lancamento;

DELETE FROM calculo_rodada;
DELETE FROM calculo_cliente_config;

DELETE FROM tarefa_operacional;

DELETE FROM agenda_evento;

DELETE FROM auditoria_atividade;

DELETE FROM processo_prazo;
DELETE FROM processo_andamento;
DELETE FROM processo_parte;
DELETE FROM processo;

DELETE FROM usuario_perfil WHERE usuario_id <> 1;

DELETE FROM pessoa_contato WHERE pessoa_id <> 1;
DELETE FROM pessoa_endereco WHERE pessoa_id <> 1;
DELETE FROM pessoa_complementar WHERE pessoa_id <> 1;

UPDATE pessoa SET responsavel_id = NULL WHERE responsavel_id IS NOT NULL AND responsavel_id <> 1;

DELETE FROM usuarios WHERE id <> 1;
ALTER TABLE usuarios AUTO_INCREMENT = 2;

DELETE FROM pessoa WHERE id <> 1;
ALTER TABLE pessoa AUTO_INCREMENT = 2;

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

DELETE FROM topico_hierarquia;
INSERT INTO topico_hierarquia (id, raiz_json) VALUES (1, '{"id":"_raiz","label":"Início","children":[{"id":"contratos","label":"CONTRATOS","children":[{"id":"contratos-cv","label":"COMPRA E VENDA + CONFISSÃO DE DÍVIDA","items":[{"id":"contratos-cv-1","label":"CARTEIRA DE CLIENTES"},{"id":"contratos-cv-2","label":"COM GARANTIA"},{"id":"contratos-cv-3","label":"IMÓVEL"},{"id":"contratos-cv-4","label":"PERMUTA"},{"id":"contratos-cv-5","label":"VEÍCULOS"},{"id":"contratos-cv-6","label":"OUTROS BENS"},{"id":"contratos-cv-7","label":"CLÁUSULAS ESPECIAIS"},{"id":"contratos-cv-8","label":"FORMA DE PAGAMENTO"},{"id":"contratos-cv-9","label":"DOCUMENTAÇÃO"},{"id":"contratos-cv-10","label":"REGISTRO"},{"id":"contratos-cv-11","label":"OBRIGAÇÕES ACESSÓRIAS"},{"id":"contratos-cv-12","label":"DISPOSIÇÕES FINAIS"}]},{"id":"contratos-trab","label":"DE TRABALHO","items":[{"id":"contratos-trab-servicos-medicos","label":"Serviços médicos"}]},{"id":"contratos-gar","label":"GARANTIDORA","items":[{"id":"contratos-gar-geral","label":"Geral"}]},{"id":"contratos-hon","label":"HONORÁRIOS ADVOCATÍCIOS","items":[{"id":"contratos-hon-condominios","label":"Condomínios"},{"id":"contratos-hon-geral","label":"Geral"}]},{"id":"contratos-imob","label":"INTERMEDIAÇÃO IMOBILIÁRIA","selecaoUnica":true,"items":[{"id":"contratos-imob-geral","label":"Geral"}]},{"id":"contratos-loc","label":"LOCAÇÃO","selecaoUnica":true,"items":[{"id":"contratos-loc-caucao","label":"Com caução"},{"id":"contratos-loc-distrato","label":"Distrato"},{"id":"contratos-loc-multa-fixa","label":"Geral — multa fixa"},{"id":"contratos-loc-multa-prop","label":"Geral — multa proporcional"}]},{"id":"contratos-mus","label":"SERVIÇOS MUSICAIS","items":[{"id":"cm-1","label":"Item exemplo musical 1"}]}]},{"id":"dativos","label":"DATIVOS","children":[{"id":"dativos-n1","label":"NÍVEL DATIVOS A","children":[{"id":"dativos-n2","label":"NÍVEL DATIVOS B","items":[{"id":"d-1","label":"Tópico dativo 1"},{"id":"d-2","label":"Tópico dativo 2"},{"id":"d-3","label":"Tópico dativo 3"}]}]}]},{"id":"impugnacoes","label":"IMPUGNAÇÕES","items":[{"id":"imp-1","label":"Fundamentação"}]},{"id":"inicial","label":"INICIAL","items":[{"id":"ini-1","label":"Fatos"}]},{"id":"recurso","label":"RECURSO","items":[{"id":"rec-1","label":"Preliminares"}]},{"id":"requerimentos","label":"REQUERIMENTOS","items":[{"id":"req-1","label":"Pedido genérico"}]}]}');
