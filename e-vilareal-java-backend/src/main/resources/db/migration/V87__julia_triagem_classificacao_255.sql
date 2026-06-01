-- Classificações da Júlia podem exceder VARCHAR(120) (ex.: intimações longas).

ALTER TABLE julia_triagem
    MODIFY COLUMN classificacao VARCHAR(255) NULL;
