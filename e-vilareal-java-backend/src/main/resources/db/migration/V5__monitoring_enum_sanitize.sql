-- Normaliza valores de enum gravados de forma inválida (evita falha ao mapear MonitoredPerson no Hibernate).
UPDATE monitored_people
SET global_frequency_type = 'HOURS_6'
WHERE global_frequency_type IS NULL
   OR TRIM(global_frequency_type) = ''
   OR global_frequency_type NOT IN (
        'MINUTES_15', 'MINUTES_30', 'HOURS_1', 'HOURS_6', 'HOURS_12', 'DAILY', 'BUSINESS_HOURS'
    );

UPDATE monitored_people
SET monitor_mode = 'HYBRID'
WHERE monitor_mode IS NULL
   OR TRIM(monitor_mode) = ''
   OR monitor_mode NOT IN ('HYBRID', 'KNOWN_PROCESSES_ONLY', 'CONSERVATIVE');
