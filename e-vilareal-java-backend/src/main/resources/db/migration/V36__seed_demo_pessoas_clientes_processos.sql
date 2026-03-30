-- Dados de demonstração (substitui o seed removido de V3 e os mocks estáticos esvaziados no frontend).
-- Idempotente: não sobrescreve pessoas/processos já existentes com os mesmos ids / chaves naturais.
-- Convenção: código de cliente canônico = LPAD(pessoa.id, 8, '0'); processos por (pessoa_id, numero_interno).

-- 10 pessoas (ids 2–11). CPFs prefixo 99…; email NULL (evita uk_pessoa_email se já existir e-mail demo no ambiente).
INSERT INTO pessoa (id, nome, cpf, email, telefone, data_nascimento, ativo, marcado_monitoramento, responsavel_id, created_at, updated_at)
SELECT 2, 'Cliente demonstração 02', '99000000002', NULL, NULL, NULL, TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pessoa WHERE id = 2)
  AND NOT EXISTS (SELECT 1 FROM pessoa WHERE cpf = '99000000002');

INSERT INTO pessoa (id, nome, cpf, email, telefone, data_nascimento, ativo, marcado_monitoramento, responsavel_id, created_at, updated_at)
SELECT 3, 'Cliente demonstração 03', '99000000003', NULL, NULL, NULL, TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pessoa WHERE id = 3)
  AND NOT EXISTS (SELECT 1 FROM pessoa WHERE cpf = '99000000003');

INSERT INTO pessoa (id, nome, cpf, email, telefone, data_nascimento, ativo, marcado_monitoramento, responsavel_id, created_at, updated_at)
SELECT 4, 'Cliente demonstração 04', '99000000004', NULL, NULL, NULL, TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pessoa WHERE id = 4)
  AND NOT EXISTS (SELECT 1 FROM pessoa WHERE cpf = '99000000004');

INSERT INTO pessoa (id, nome, cpf, email, telefone, data_nascimento, ativo, marcado_monitoramento, responsavel_id, created_at, updated_at)
SELECT 5, 'Cliente demonstração 05', '99000000005', NULL, NULL, NULL, TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pessoa WHERE id = 5)
  AND NOT EXISTS (SELECT 1 FROM pessoa WHERE cpf = '99000000005');

INSERT INTO pessoa (id, nome, cpf, email, telefone, data_nascimento, ativo, marcado_monitoramento, responsavel_id, created_at, updated_at)
SELECT 6, 'Cliente demonstração 06', '99000000006', NULL, NULL, NULL, TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pessoa WHERE id = 6)
  AND NOT EXISTS (SELECT 1 FROM pessoa WHERE cpf = '99000000006');

INSERT INTO pessoa (id, nome, cpf, email, telefone, data_nascimento, ativo, marcado_monitoramento, responsavel_id, created_at, updated_at)
SELECT 7, 'Cliente demonstração 07', '99000000007', NULL, NULL, NULL, TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pessoa WHERE id = 7)
  AND NOT EXISTS (SELECT 1 FROM pessoa WHERE cpf = '99000000007');

INSERT INTO pessoa (id, nome, cpf, email, telefone, data_nascimento, ativo, marcado_monitoramento, responsavel_id, created_at, updated_at)
SELECT 8, 'Cliente demonstração 08', '99000000008', NULL, NULL, NULL, TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pessoa WHERE id = 8)
  AND NOT EXISTS (SELECT 1 FROM pessoa WHERE cpf = '99000000008');

INSERT INTO pessoa (id, nome, cpf, email, telefone, data_nascimento, ativo, marcado_monitoramento, responsavel_id, created_at, updated_at)
SELECT 9, 'Cliente demonstração 09', '99000000009', NULL, NULL, NULL, TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pessoa WHERE id = 9)
  AND NOT EXISTS (SELECT 1 FROM pessoa WHERE cpf = '99000000009');

INSERT INTO pessoa (id, nome, cpf, email, telefone, data_nascimento, ativo, marcado_monitoramento, responsavel_id, created_at, updated_at)
SELECT 10, 'Cliente demonstração 10', '99000000010', NULL, NULL, NULL, TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pessoa WHERE id = 10)
  AND NOT EXISTS (SELECT 1 FROM pessoa WHERE cpf = '99000000010');

INSERT INTO pessoa (id, nome, cpf, email, telefone, data_nascimento, ativo, marcado_monitoramento, responsavel_id, created_at, updated_at)
SELECT 11, 'Cliente demonstração 11', '99000000011', NULL, NULL, NULL, TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pessoa WHERE id = 11)
  AND NOT EXISTS (SELECT 1 FROM pessoa WHERE cpf = '99000000011');

-- Só cria `cliente` onde a pessoa existe (evita erro de FK se inserts de pessoa foram ignorados).
INSERT IGNORE INTO cliente (codigo_cliente, pessoa_id)
SELECT LPAD(p.id, 8, '0'), p.id
FROM pessoa p
WHERE p.id BETWEEN 2 AND 11;

INSERT INTO cliente (codigo_cliente, pessoa_id)
SELECT CONCAT('9', LPAD(p.id, 7, '0')), p.id
FROM pessoa p
WHERE p.id BETWEEN 2 AND 11
  AND NOT EXISTS (SELECT 1 FROM cliente c WHERE c.pessoa_id = p.id);

-- Complemento opcional (descrição ação — alinhado ao cadastro clientes / processos)
INSERT IGNORE INTO pessoa_complementar (pessoa_id, rg, orgao_expedidor, profissao, nacionalidade, estado_civil, genero, descricao_acao)
SELECT p.id, NULL, NULL, NULL, NULL, NULL, NULL, CONCAT('Descrição de ação (demo) — pessoa ', p.id)
FROM pessoa p
WHERE p.id BETWEEN 2 AND 11;

-- Processos: 2 por cliente (numero_interno 1 e 2), total 20
INSERT INTO processo (pessoa_id, numero_interno, numero_cnj, numero_processo_antigo, natureza_acao, descricao_acao, competencia, fase, status, ativo, consulta_automatica)
SELECT p.id, 1,
       CONCAT('500', LPAD(p.id, 2, '0'), '-00.2024.8.26.0001'),
       CONCAT('AP ', p.id, '/001'),
       'Cível',
       CONCAT('Processo demonstração nº 1 — cliente código ', LPAD(p.id, 8, '0')),
       'Estadual',
       'Conhecimento',
       'Ativo',
       TRUE,
       FALSE
FROM pessoa p
WHERE p.id BETWEEN 2 AND 11
  AND NOT EXISTS (SELECT 1 FROM processo pr WHERE pr.pessoa_id = p.id AND pr.numero_interno = 1);

INSERT INTO processo (pessoa_id, numero_interno, numero_cnj, numero_processo_antigo, natureza_acao, descricao_acao, competencia, fase, status, ativo, consulta_automatica)
SELECT p.id, 2,
       CONCAT('500', LPAD(p.id, 2, '0'), '-00.2024.8.26.0002'),
       CONCAT('AP ', p.id, '/002'),
       'Cível',
       CONCAT('Processo demonstração nº 2 — cliente código ', LPAD(p.id, 8, '0')),
       'Estadual',
       'Execução',
       'Ativo',
       TRUE,
       FALSE
FROM pessoa p
WHERE p.id BETWEEN 2 AND 11
  AND NOT EXISTS (SELECT 1 FROM processo pr WHERE pr.pessoa_id = p.id AND pr.numero_interno = 2);

-- Próximo id após inserções explícitas: o InnoDB/MySQL 8 ajusta AUTO_INCREMENT automaticamente
-- (MAX(id)+1). Evitamos PREPARE/EXECUTE dinâmico aqui por incompatibilidade com alguns modos Flyway/transação.
