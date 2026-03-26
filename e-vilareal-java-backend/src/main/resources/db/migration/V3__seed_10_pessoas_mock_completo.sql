-- 10 pessoas a partir do mock `e-vilareal-react-web/src/data/cadastroPessoasMock.js` (ids mock 1–10).
-- Cadastro completo: núcleo + complementares + endereço(s) + contatos (e-mail e telefone).
-- Pessoa id=1 (admin) já existe em V2; estes usam ids 2–11.

INSERT INTO pessoa (id, nome, cpf, email, telefone, data_nascimento, ativo, marcado_monitoramento, responsavel_id, created_at, updated_at)
VALUES
    (2, 'A C COMERCIO DE PISCINAS LTDA', '09319421000154', 'pessoa1@mock.vilareal.local', '6130201001', NULL, TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (3, 'ADAILSON FRANCISCO DE BRITO', '78866260100', 'pessoa2@mock.vilareal.local', '61988776601', '1985-03-12', TRUE, TRUE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (4, 'ADAIR BENTO DOS SANTOS', '84090510104', 'pessoa3@mock.vilareal.local', '61977665502', '1990-07-22', TRUE, FALSE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (5, 'ADAIR DE SIQUEIRA NUNES JUNIOR', '02341965130', 'pessoa4@mock.vilareal.local', '61966554403', '1988-11-05', TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (6, 'ADAO PEREIRA DA COSTA', '98242482187', 'pessoa5@mock.vilareal.local', '61955443304', '1975-01-30', TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (7, 'ADELIA MARIANO DE FARIA', '28885449115', 'pessoa6@mock.vilareal.local', '61944332205', '1992-09-18', TRUE, TRUE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (8, 'ADELMONT DE OLIVEIRA JUNIOR', '13338773153', 'pessoa7@mock.vilareal.local', '61933221106', '1983-04-25', TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (9, 'ADENILSON PEREIRA SILVA', '88172660197', 'pessoa8@mock.vilareal.local', '61922110007', '1995-12-01', TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (10, 'ADENILSON RODRIGUES NEGRAMES', '81124465120', 'pessoa9@mock.vilareal.local', '61911009908', '1987-06-14', TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (11, 'ADERBAL CAMILO DO NASCIMENTO', '64207846115', 'pessoa10@mock.vilareal.local', '61900998809', '1991-02-28', TRUE, FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE pessoa AUTO_INCREMENT = 12;

INSERT INTO pessoa_complementar (pessoa_id, rg, orgao_expedidor, profissao, nacionalidade, estado_civil, genero) VALUES
    (2, NULL, NULL, 'Comércio varejista', 'Brasileira', NULL, NULL),
    (3, '4589012', 'SSP/DF', 'Engenheiro civil', 'Brasileira', 'CASADO', 'M'),
    (4, '3298877', 'SSP/GO', 'Motorista', 'Brasileira', 'SOLTEIRO', 'M'),
    (5, '1122334', 'SSP/GO', 'Administrador', 'Brasileira', 'UNIAO', 'M'),
    (6, '5566778', 'SSP/GO', 'Aposentado', 'Brasileira', 'VIUVO', 'M'),
    (7, '9988776', 'SSP/DF', 'Professora', 'Brasileira', 'SOLTEIRO', 'F'),
    (8, '4433221', 'SSP/GO', 'Comerciante', 'Brasileira', 'CASADO', 'M'),
    (9, '7788990', 'SSP/GO', 'Técnico em informática', 'Brasileira', 'SOLTEIRO', 'M'),
    (10, '6655443', 'SSP/GO', 'Eletricista', 'Brasileira', 'DIVORCIADO', 'M'),
    (11, '3344556', 'SSP/GO', 'Advogado', 'Brasileira', 'CASADO', 'M');

INSERT INTO pessoa_endereco (pessoa_id, numero_ordem, rua, bairro, estado, cidade, cep, auto_preenchido) VALUES
    (2, 1, 'QS 7 Rua 200, Lote 15', 'Taguatinga Sul', 'DF', 'Brasília', '72015550', FALSE),
    (3, 1, 'Rua das Flores, 120', 'Setor Oeste', 'GO', 'Goiânia', '74115130', FALSE),
    (3, 2, 'Av. Central, 500', 'Centro', 'GO', 'Aparecida de Goiânia', '74900000', FALSE),
    (4, 1, 'Alameda dos Ipês, 88', 'Jardim América', 'GO', 'Goiânia', '74275150', FALSE),
    (5, 1, 'Rua 15, 2040', 'Setor Bueno', 'GO', 'Goiânia', '74230120', FALSE),
    (6, 1, 'Quadra 8 Conjunto A', 'Sobradinho', 'DF', 'Brasília', '73050108', FALSE),
    (7, 1, 'Rua do Lago, 45', 'Lago Norte', 'DF', 'Brasília', '71505100', FALSE),
    (7, 2, 'CLSW 101 Bloco B', 'Sudoeste', 'DF', 'Brasília', '70673522', TRUE),
    (8, 1, 'Av. T-63, 1500', 'Setor Bueno', 'GO', 'Goiânia', '7423010', FALSE),
    (9, 1, 'Rua 22, 330', 'Setor Sul', 'GO', 'Goiânia', '7408510', FALSE),
    (10, 1, 'Rua das Palmeiras, 77', 'Centro', 'GO', 'Anápolis', '75023010', FALSE),
    (11, 1, 'Av. Independência, 990', 'Centro', 'GO', 'Goiânia', '74045010', FALSE);

INSERT INTO pessoa_contato (pessoa_id, tipo, valor, data_lancamento, data_alteracao, usuario_lancamento) VALUES
    (2, 'email', 'pessoa1@mock.vilareal.local', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (2, 'telefone', '6130201001', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (2, 'website', 'https://mock-piscinas.vilareal.local', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (3, 'email', 'pessoa2@mock.vilareal.local', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (3, 'telefone', '61988776601', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (4, 'email', 'pessoa3@mock.vilareal.local', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (4, 'telefone', '61977665502', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (5, 'email', 'pessoa4@mock.vilareal.local', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (5, 'telefone', '61966554403', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (6, 'email', 'pessoa5@mock.vilareal.local', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (6, 'telefone', '61955443304', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (7, 'email', 'pessoa6@mock.vilareal.local', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (7, 'telefone', '61944332205', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (8, 'email', 'pessoa7@mock.vilareal.local', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (8, 'telefone', '61933221106', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (9, 'email', 'pessoa8@mock.vilareal.local', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (9, 'telefone', '61922110007', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (10, 'email', 'pessoa9@mock.vilareal.local', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (10, 'telefone', '61911009908', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (11, 'email', 'pessoa10@mock.vilareal.local', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway'),
    (11, 'telefone', '61900998809', '2024-06-01 09:00:00.000', '2024-06-01 09:00:00.000', 'seed-flyway');
