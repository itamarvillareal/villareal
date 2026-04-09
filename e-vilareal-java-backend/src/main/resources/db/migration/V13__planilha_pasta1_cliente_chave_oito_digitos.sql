-- Normaliza chave_cliente numérica para 8 dígitos (ex.: 0001 -> 00000001), alinhado ao CodigoClienteUtil.
UPDATE planilha_pasta1_cliente p
INNER JOIN (
    SELECT chave_cliente AS chave_antiga,
           LPAD(CAST(chave_cliente AS UNSIGNED), 8, '0') AS chave_nova
    FROM planilha_pasta1_cliente
    WHERE chave_cliente REGEXP '^[0-9]+$'
      AND LENGTH(chave_cliente) < 8
) x ON p.chave_cliente = x.chave_antiga
SET p.chave_cliente = x.chave_nova;
