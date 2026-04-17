-- Fase processual vazia ou nula passa a ser tratada como "Em Andamento" (regra de negócio + UI).
UPDATE processo
SET fase = 'Em Andamento'
WHERE fase IS NULL OR TRIM(fase) = '';
