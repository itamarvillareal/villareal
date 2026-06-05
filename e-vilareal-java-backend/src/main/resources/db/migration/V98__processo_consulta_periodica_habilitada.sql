-- Interruptor mestre: consultas periódicas automáticas e painel por processo.
ALTER TABLE processo
    ADD COLUMN consulta_periodica_habilitada BOOLEAN NOT NULL DEFAULT TRUE
    COMMENT 'FALSE: fora do painel e do scheduler; monitor manual e histórico permanecem';
