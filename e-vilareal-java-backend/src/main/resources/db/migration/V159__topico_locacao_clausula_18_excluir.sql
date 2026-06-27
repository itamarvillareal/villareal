-- Modelo «GERAL - Multa fixa»: remove a Cláusula 18ª (prazos/obrigações sem interpelação).
UPDATE topico
SET ativo = 0
WHERE chave_navegacao LIKE '%GERAL - Multa fixa'
  AND bloco_indice = 41
  AND conteudo_template LIKE '%Os prazos e as obriga%'
  AND conteudo_template LIKE '%independentemente de interpela%';
