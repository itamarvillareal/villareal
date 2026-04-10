-- =============================================================================
-- Apaga TODOS os compromissos da agenda no MySQL (tabela agenda_evento).
--
-- Útil após importações duplicadas (XLSX/script). Não remove utilizadores.
--
-- Uso:
--   mysql -u root -p nome_da_base < scripts/limpar_toda_agenda.sql
--
-- Dev local (application-dev.properties): base vilareal, user root.
-- Faça backup se precisar: mysqldump … agenda_evento
-- =============================================================================

START TRANSACTION;

DELETE FROM agenda_evento;

COMMIT;

-- SELECT COUNT(*) AS eventos_restantes FROM agenda_evento;
