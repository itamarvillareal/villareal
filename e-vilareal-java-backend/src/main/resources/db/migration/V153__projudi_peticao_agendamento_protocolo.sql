-- Agendamento de protocolo PROJUDI (disparo automático em horário fixo).

ALTER TABLE projudi_peticao
    ADD COLUMN protocolo_agendado_para TIMESTAMP(3) NULL AFTER protocolo_etapa;

CREATE INDEX idx_projudi_peticao_agendado
    ON projudi_peticao (status, protocolo_agendado_para);
