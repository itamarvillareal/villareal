-- Repeatable, idempotente: dados mínimos para ITs (substitui o noop V100__test_bootstrap removido).
-- V12 já insere pessoa/usuario itamar; aqui garantimos cliente + processos para testes de integração.

INSERT INTO cliente (codigo_cliente, pessoa_id, nome_referencia, inativo)
SELECT '00000867', 867, 'ITAMAR TESTE INTEGRACAO', FALSE
FROM DUAL
WHERE EXISTS (SELECT 1 FROM pessoa WHERE id = 867)
  AND NOT EXISTS (SELECT 1 FROM cliente WHERE pessoa_id = 867);

INSERT INTO cliente (codigo_cliente, pessoa_id, nome_referencia, inativo)
SELECT '00001085', 1085, 'KARLA TESTE INTEGRACAO', FALSE
FROM DUAL
WHERE EXISTS (SELECT 1 FROM pessoa WHERE id = 1085)
  AND NOT EXISTS (SELECT 1 FROM cliente WHERE pessoa_id = 1085);

INSERT INTO cliente (codigo_cliente, pessoa_id, nome_referencia, inativo)
SELECT '00006899', 6899, 'ANA TESTE INTEGRACAO', FALSE
FROM DUAL
WHERE EXISTS (SELECT 1 FROM pessoa WHERE id = 6899)
  AND NOT EXISTS (SELECT 1 FROM cliente WHERE pessoa_id = 6899);

INSERT INTO processo (
    pessoa_id, cliente_id, numero_interno, numero_cnj,
    consulta_automatica, consulta_periodica_habilitada, ativo)
SELECT 867, c.id, 90001, 'IT-90001.8.09.0001', FALSE, FALSE, TRUE
FROM cliente c
WHERE c.pessoa_id = 867
  AND NOT EXISTS (SELECT 1 FROM processo p WHERE p.pessoa_id = 867 AND p.numero_interno = 90001);

INSERT INTO processo (
    pessoa_id, cliente_id, numero_interno, numero_cnj,
    consulta_automatica, consulta_periodica_habilitada, ativo)
SELECT 1085, c.id, 90002, 'IT-90002.8.09.0002', FALSE, FALSE, TRUE
FROM cliente c
WHERE c.pessoa_id = 1085
  AND NOT EXISTS (SELECT 1 FROM processo p WHERE p.pessoa_id = 1085 AND p.numero_interno = 90002);

INSERT INTO processo (
    pessoa_id, cliente_id, numero_interno, numero_cnj,
    consulta_automatica, consulta_periodica_habilitada, ativo)
SELECT 6899, c.id, 90003, 'IT-90003.8.09.0003', FALSE, FALSE, TRUE
FROM cliente c
WHERE c.pessoa_id = 6899
  AND NOT EXISTS (SELECT 1 FROM processo p WHERE p.pessoa_id = 6899 AND p.numero_interno = 90003);
