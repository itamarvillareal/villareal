-- Alinha charset/collation das tabelas de processo ao padrão utf8mb4 usado em `topico_hierarquia` (V7).

ALTER TABLE processo CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE processo_parte CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE processo_andamento CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE processo_prazo CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE processo_parte_advogado CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
