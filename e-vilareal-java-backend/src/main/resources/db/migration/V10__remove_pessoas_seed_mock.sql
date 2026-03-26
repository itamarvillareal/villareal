-- Remove todas as pessoas inseridas pelo seed mock (id > 1). Mantém pessoa id=1 (admin, V2).

DELETE pp FROM processo_prazo pp
         INNER JOIN processo p ON p.id = pp.processo_id
WHERE p.pessoa_id > 1;

DELETE pa FROM processo_andamento pa
         INNER JOIN processo p ON p.id = pa.processo_id
WHERE p.pessoa_id > 1;

DELETE ppart FROM processo_parte ppart
         INNER JOIN processo p ON p.id = ppart.processo_id
WHERE p.pessoa_id > 1;

DELETE FROM processo WHERE pessoa_id > 1;

DELETE FROM pessoa WHERE id > 1;

ALTER TABLE pessoa AUTO_INCREMENT = 2;
