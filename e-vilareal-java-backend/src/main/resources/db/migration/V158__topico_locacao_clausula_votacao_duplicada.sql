-- Modelo «GERAL - Multa fixa»: blocos 47 e 48 repetiam a mesma cláusula de votação em assembleia.
-- Mantém o bloco 47 (flexão Adequa do Locador); desativa a variante redundante.
UPDATE topico
SET ativo = 0
WHERE chave_navegacao LIKE '%GERAL - Multa fixa'
  AND bloco_indice = 48
  AND conteudo_template LIKE '%assembleias condominiais%';
