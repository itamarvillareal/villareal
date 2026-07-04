-- Canonização nono dígito (Opção B): celular BR 12 dígitos → 13 (insere 9 após DDD).
-- Filtro (TODAS as operações): LENGTH=12 AND SUBSTRING(...,5,1) IN ('6','7','8','9').
-- Fixos (local 2–5) e números já em 13 NÃO são tocados.
-- Produção (medição): ~328 msgs / 100 celulares-12 em whatsapp_messages; ~85 regs satélite; 0 colisões MERGE.
-- Flyway envolve migrações só-DML em transação InnoDB (rollback automático se qualquer passo falhar).

-- ---------------------------------------------------------------------------
-- a) whatsapp_conversation_read (PK = phone_number)
--    MERGE defensivo ANTES do UPDATE (evita violação de PK).
--    Esperado prod: 0 colisões; local de teste pode ter 1+.
-- ---------------------------------------------------------------------------

-- Funde last_read_at na variante-13 quando ambas existem.
UPDATE whatsapp_conversation_read r13
INNER JOIN whatsapp_conversation_read r12
        ON r13.phone_number = CONCAT(LEFT(r12.phone_number, 4), '9', SUBSTRING(r12.phone_number, 5))
SET r13.last_read_at = GREATEST(r13.last_read_at, r12.last_read_at)
WHERE LENGTH(r12.phone_number) = 12
  AND SUBSTRING(r12.phone_number, 5, 1) IN ('6', '7', '8', '9');

-- Remove a linha-12 após merge.
DELETE r12
FROM whatsapp_conversation_read r12
INNER JOIN whatsapp_conversation_read r13
        ON r13.phone_number = CONCAT(LEFT(r12.phone_number, 4), '9', SUBSTRING(r12.phone_number, 5))
WHERE LENGTH(r12.phone_number) = 12
  AND SUBSTRING(r12.phone_number, 5, 1) IN ('6', '7', '8', '9');

-- Demais celulares-12 sem par-13: renomeia 12→13.
UPDATE whatsapp_conversation_read
SET phone_number = CONCAT(LEFT(phone_number, 4), '9', SUBSTRING(phone_number, 5))
WHERE LENGTH(phone_number) = 12
  AND SUBSTRING(phone_number, 5, 1) IN ('6', '7', '8', '9')
  AND LENGTH(CONCAT(LEFT(phone_number, 4), '9', SUBSTRING(phone_number, 5))) = 13;

-- ---------------------------------------------------------------------------
-- b) cliente_whatsapp (UNIQUE cliente_id + numero)
--    Se (cliente_id, numero_13) já existe → remove o registro-12; senão UPDATE.
--    Esperado prod: 2 regs celular-12; 0 colisões.
-- ---------------------------------------------------------------------------

DELETE cw12
FROM cliente_whatsapp cw12
INNER JOIN cliente_whatsapp cw13
        ON cw13.cliente_id = cw12.cliente_id
       AND cw13.numero = CONCAT(LEFT(cw12.numero, 4), '9', SUBSTRING(cw12.numero, 5))
WHERE LENGTH(cw12.numero) = 12
  AND SUBSTRING(cw12.numero, 5, 1) IN ('6', '7', '8', '9');

UPDATE cliente_whatsapp
SET numero = CONCAT(LEFT(numero, 4), '9', SUBSTRING(numero, 5))
WHERE LENGTH(numero) = 12
  AND SUBSTRING(numero, 5, 1) IN ('6', '7', '8', '9')
  AND LENGTH(CONCAT(LEFT(numero, 4), '9', SUBSTRING(numero, 5))) = 13;

-- ---------------------------------------------------------------------------
-- c) whatsapp_messages — UPDATE direto (sem PK em phone_number).
--    Esperado prod: ~328 linhas.
-- ---------------------------------------------------------------------------

UPDATE whatsapp_messages
SET phone_number = CONCAT(LEFT(phone_number, 4), '9', SUBSTRING(phone_number, 5))
WHERE LENGTH(phone_number) = 12
  AND SUBSTRING(phone_number, 5, 1) IN ('6', '7', '8', '9')
  AND LENGTH(CONCAT(LEFT(phone_number, 4), '9', SUBSTRING(phone_number, 5))) = 13;

-- ---------------------------------------------------------------------------
-- d) whatsapp_cobrancas — UPDATE direto. Esperado prod: ~23 linhas.
-- ---------------------------------------------------------------------------

UPDATE whatsapp_cobrancas
SET phone_number = CONCAT(LEFT(phone_number, 4), '9', SUBSTRING(phone_number, 5))
WHERE LENGTH(phone_number) = 12
  AND SUBSTRING(phone_number, 5, 1) IN ('6', '7', '8', '9')
  AND LENGTH(CONCAT(LEFT(phone_number, 4), '9', SUBSTRING(phone_number, 5))) = 13;

-- ---------------------------------------------------------------------------
-- e) scheduled_whatsapp_messages — UPDATE direto (inclui PENDING).
--    Esperado prod: ~53 linhas.
-- ---------------------------------------------------------------------------

UPDATE scheduled_whatsapp_messages
SET phone_number = CONCAT(LEFT(phone_number, 4), '9', SUBSTRING(phone_number, 5))
WHERE LENGTH(phone_number) = 12
  AND SUBSTRING(phone_number, 5, 1) IN ('6', '7', '8', '9')
  AND LENGTH(CONCAT(LEFT(phone_number, 4), '9', SUBSTRING(phone_number, 5))) = 13;

-- ---------------------------------------------------------------------------
-- f) whatsapp_aniversarios — UPDATE direto. Esperado prod: ~7 linhas.
-- ---------------------------------------------------------------------------

UPDATE whatsapp_aniversarios
SET phone_number = CONCAT(LEFT(phone_number, 4), '9', SUBSTRING(phone_number, 5))
WHERE LENGTH(phone_number) = 12
  AND SUBSTRING(phone_number, 5, 1) IN ('6', '7', '8', '9')
  AND LENGTH(CONCAT(LEFT(phone_number, 4), '9', SUBSTRING(phone_number, 5))) = 13;
