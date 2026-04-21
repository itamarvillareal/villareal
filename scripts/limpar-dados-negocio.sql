-- =============================================================================
-- limpar-dados-negocio.sql — Zerar dados de negócio (preservar login e estrutura)
-- =============================================================================
-- Propósito:
--   Remove dados de negócio (processos, clientes, financeiro, imóveis, agenda,
--   etc.) mantendo: flyway_schema_history, perfil, topico_hierarquia, usuarios
--   (todas as linhas), e apenas as linhas de pessoa referenciadas por
--   usuarios.pessoa_id, com pessoa_complementar / pessoa_endereco / pessoa_contato
--   dessas pessoas.
--
-- Atenção:
--   NÃO executar em produção (VPS) sem backup recente (mysqldump).
--   Em ambiente local (Docker), pode reexecutar após docker compose down -v.
--
-- Como invocar:
--   Docker (Windows / Linux):
--     docker exec -i vilareal-db mysql -uroot -proot vilareal < scripts/limpar-dados-negocio.sql
--   SSH no servidor (exemplo; ajustar credenciais):
--     ssh root@HOST "mysql -uroot -pSENHA vilareal" < scripts/limpar-dados-negocio.sql
-- =============================================================================

SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS;
SET @OLD_UNIQUE_CHECKS = @@UNIQUE_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;
SET UNIQUE_CHECKS = 0;

START TRANSACTION;

-- ---------------------------------------------------------------------------
-- Pessoas a preservar (FK obrigatória usuarios → pessoa)
-- ---------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_pessoas_preservar;
CREATE TEMPORARY TABLE tmp_pessoas_preservar (id BIGINT PRIMARY KEY) ENGINE=MEMORY;
INSERT INTO tmp_pessoas_preservar (id)
SELECT DISTINCT pessoa_id FROM usuarios WHERE pessoa_id IS NOT NULL;

SELECT 'AUDITORIA inicio usuarios' AS etapa, COUNT(*) AS linhas_restantes FROM usuarios;
SELECT 'AUDITORIA inicio pessoa' AS etapa, COUNT(*) AS linhas_restantes FROM pessoa;

-- Auto-referência pessoa.responsavel_id: evitar referências a pessoas que serão apagadas
UPDATE pessoa p
SET p.responsavel_id = NULL
WHERE p.responsavel_id IS NOT NULL
  AND p.responsavel_id NOT IN (SELECT id FROM tmp_pessoas_preservar);

SELECT 'AUDITORIA apos null_responsavel_id' AS etapa, COUNT(*) AS com_resp
FROM pessoa WHERE responsavel_id IS NOT NULL;

-- Ordem: dependentes de processo / financeiro / imóveis primeiro (filho → pai)
DELETE FROM processo_prazo;
SELECT 'AUDITORIA apos processo_prazo' AS etapa, COUNT(*) AS linhas_restantes FROM processo_prazo;

DELETE FROM processo_parte_advogado;
SELECT 'AUDITORIA apos processo_parte_advogado' AS etapa, COUNT(*) AS linhas_restantes FROM processo_parte_advogado;

DELETE FROM processo_parte;
SELECT 'AUDITORIA apos processo_parte' AS etapa, COUNT(*) AS linhas_restantes FROM processo_parte;

DELETE FROM processo_andamento;
SELECT 'AUDITORIA apos processo_andamento' AS etapa, COUNT(*) AS linhas_restantes FROM processo_andamento;

DELETE FROM publicacoes;
SELECT 'AUDITORIA apos publicacoes' AS etapa, COUNT(*) AS linhas_restantes FROM publicacoes;

DELETE FROM financeiro_lancamento;
SELECT 'AUDITORIA apos financeiro_lancamento' AS etapa, COUNT(*) AS linhas_restantes FROM financeiro_lancamento;

DELETE FROM locacao_repasse;
SELECT 'AUDITORIA apos locacao_repasse' AS etapa, COUNT(*) AS linhas_restantes FROM locacao_repasse;

DELETE FROM locacao_despesa;
SELECT 'AUDITORIA apos locacao_despesa' AS etapa, COUNT(*) AS linhas_restantes FROM locacao_despesa;

DELETE FROM contrato_locacao;
SELECT 'AUDITORIA apos contrato_locacao' AS etapa, COUNT(*) AS linhas_restantes FROM contrato_locacao;

DELETE FROM imovel;
SELECT 'AUDITORIA apos imovel' AS etapa, COUNT(*) AS linhas_restantes FROM imovel;

DELETE FROM processo;
SELECT 'AUDITORIA apos processo' AS etapa, COUNT(*) AS linhas_restantes FROM processo;

DELETE FROM tarefa_operacional;
SELECT 'AUDITORIA apos tarefa_operacional' AS etapa, COUNT(*) AS linhas_restantes FROM tarefa_operacional;

DELETE FROM agenda_evento;
SELECT 'AUDITORIA apos agenda_evento' AS etapa, COUNT(*) AS linhas_restantes FROM agenda_evento;

DELETE FROM calculo_rodada;
SELECT 'AUDITORIA apos calculo_rodada' AS etapa, COUNT(*) AS linhas_restantes FROM calculo_rodada;

DELETE FROM calculo_cliente_config;
SELECT 'AUDITORIA apos calculo_cliente_config' AS etapa, COUNT(*) AS linhas_restantes FROM calculo_cliente_config;

DELETE FROM auditoria_atividade;
SELECT 'AUDITORIA apos auditoria_atividade' AS etapa, COUNT(*) AS linhas_restantes FROM auditoria_atividade;

DELETE FROM planilha_pasta1_cliente;
SELECT 'AUDITORIA apos planilha_pasta1_cliente' AS etapa, COUNT(*) AS linhas_restantes FROM planilha_pasta1_cliente;

DELETE FROM cliente;
SELECT 'AUDITORIA apos cliente' AS etapa, COUNT(*) AS linhas_restantes FROM cliente;

DELETE FROM financeiro_conta_contabil;
SELECT 'AUDITORIA apos financeiro_conta_contabil' AS etapa, COUNT(*) AS linhas_restantes FROM financeiro_conta_contabil;

DELETE FROM pessoa_contato
WHERE pessoa_id NOT IN (SELECT id FROM tmp_pessoas_preservar);
SELECT 'AUDITORIA apos pessoa_contato' AS etapa, COUNT(*) AS linhas_restantes FROM pessoa_contato;

DELETE FROM pessoa_endereco
WHERE pessoa_id NOT IN (SELECT id FROM tmp_pessoas_preservar);
SELECT 'AUDITORIA apos pessoa_endereco' AS etapa, COUNT(*) AS linhas_restantes FROM pessoa_endereco;

DELETE FROM pessoa_complementar
WHERE pessoa_id NOT IN (SELECT id FROM tmp_pessoas_preservar);
SELECT 'AUDITORIA apos pessoa_complementar' AS etapa, COUNT(*) AS linhas_restantes FROM pessoa_complementar;

DELETE FROM pessoa
WHERE id NOT IN (SELECT id FROM tmp_pessoas_preservar);
SELECT 'AUDITORIA apos pessoa' AS etapa, COUNT(*) AS linhas_restantes FROM pessoa;

-- ---------------------------------------------------------------------------
-- Reset AUTO_INCREMENT (tabelas esvaziadas; NÃO alterar pessoa nem tabelas preservadas)
-- ---------------------------------------------------------------------------
ALTER TABLE agenda_evento AUTO_INCREMENT = 1;
ALTER TABLE auditoria_atividade AUTO_INCREMENT = 1;
-- calculo_cliente_config: PK é VARCHAR (codigo_cliente), sem AUTO_INCREMENT
ALTER TABLE calculo_rodada AUTO_INCREMENT = 1;
ALTER TABLE cliente AUTO_INCREMENT = 1;
ALTER TABLE contrato_locacao AUTO_INCREMENT = 1;
ALTER TABLE financeiro_conta_contabil AUTO_INCREMENT = 1;
ALTER TABLE financeiro_lancamento AUTO_INCREMENT = 1;
ALTER TABLE imovel AUTO_INCREMENT = 1;
ALTER TABLE locacao_despesa AUTO_INCREMENT = 1;
ALTER TABLE locacao_repasse AUTO_INCREMENT = 1;
ALTER TABLE planilha_pasta1_cliente AUTO_INCREMENT = 1;
ALTER TABLE processo AUTO_INCREMENT = 1;
ALTER TABLE processo_andamento AUTO_INCREMENT = 1;
ALTER TABLE processo_parte AUTO_INCREMENT = 1;
ALTER TABLE processo_parte_advogado AUTO_INCREMENT = 1;
ALTER TABLE processo_prazo AUTO_INCREMENT = 1;
ALTER TABLE publicacoes AUTO_INCREMENT = 1;
ALTER TABLE tarefa_operacional AUTO_INCREMENT = 1;

COMMIT;

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS = @OLD_UNIQUE_CHECKS;

-- ---------------------------------------------------------------------------
-- Auditoria final (contagens por tabela tocada + preservados)
-- ---------------------------------------------------------------------------
SELECT 'FINAL agenda_evento' AS ref, COUNT(*) AS n FROM agenda_evento
UNION ALL SELECT 'FINAL auditoria_atividade', COUNT(*) FROM auditoria_atividade
UNION ALL SELECT 'FINAL calculo_cliente_config', COUNT(*) FROM calculo_cliente_config
UNION ALL SELECT 'FINAL calculo_rodada', COUNT(*) FROM calculo_rodada
UNION ALL SELECT 'FINAL cliente', COUNT(*) FROM cliente
UNION ALL SELECT 'FINAL contrato_locacao', COUNT(*) FROM contrato_locacao
UNION ALL SELECT 'FINAL financeiro_conta_contabil', COUNT(*) FROM financeiro_conta_contabil
UNION ALL SELECT 'FINAL financeiro_lancamento', COUNT(*) FROM financeiro_lancamento
UNION ALL SELECT 'FINAL flyway_schema_history', COUNT(*) FROM flyway_schema_history
UNION ALL SELECT 'FINAL imovel', COUNT(*) FROM imovel
UNION ALL SELECT 'FINAL locacao_despesa', COUNT(*) FROM locacao_despesa
UNION ALL SELECT 'FINAL locacao_repasse', COUNT(*) FROM locacao_repasse
UNION ALL SELECT 'FINAL perfil', COUNT(*) FROM perfil
UNION ALL SELECT 'FINAL pessoa', COUNT(*) FROM pessoa
UNION ALL SELECT 'FINAL pessoa_complementar', COUNT(*) FROM pessoa_complementar
UNION ALL SELECT 'FINAL pessoa_contato', COUNT(*) FROM pessoa_contato
UNION ALL SELECT 'FINAL pessoa_endereco', COUNT(*) FROM pessoa_endereco
UNION ALL SELECT 'FINAL planilha_pasta1_cliente', COUNT(*) FROM planilha_pasta1_cliente
UNION ALL SELECT 'FINAL processo', COUNT(*) FROM processo
UNION ALL SELECT 'FINAL processo_andamento', COUNT(*) FROM processo_andamento
UNION ALL SELECT 'FINAL processo_parte', COUNT(*) FROM processo_parte
UNION ALL SELECT 'FINAL processo_parte_advogado', COUNT(*) FROM processo_parte_advogado
UNION ALL SELECT 'FINAL processo_prazo', COUNT(*) FROM processo_prazo
UNION ALL SELECT 'FINAL publicacoes', COUNT(*) FROM publicacoes
UNION ALL SELECT 'FINAL tarefa_operacional', COUNT(*) FROM tarefa_operacional
UNION ALL SELECT 'FINAL topico_hierarquia', COUNT(*) FROM topico_hierarquia
UNION ALL SELECT 'FINAL usuarios', COUNT(*) FROM usuarios;

SELECT 'usuarios_apos_limpeza' AS ref, id, login, pessoa_id FROM usuarios ORDER BY id;
SELECT 'pessoa_apos_limpeza' AS ref, id, nome, cpf FROM pessoa ORDER BY id;
