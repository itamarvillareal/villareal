-- Cadência periódica (diário/semanal/quinzenal/mensal/bimestral/semestral/anual).

ALTER TABLE agendamento_consulta
    ADD COLUMN periodo VARCHAR(20) NULL COMMENT 'PeriodoCadencia — apenas tipo PERIODICO',
    ADD COLUMN periodo_horario TIME NULL COMMENT 'Hora do dia da execução periódica';
