-- Zera referências operacionais a publicações nas tarefas (não há tabela publicacoes nas migrações atuais).

UPDATE tarefa_operacional SET publicacao_id = NULL WHERE publicacao_id IS NOT NULL;
