-- Checkboxes da confirmação do peticionamento PROJUDI (PaginaAtual=5).

ALTER TABLE projudi_peticao
    ADD COLUMN pedido_urgencia TINYINT(1) NOT NULL DEFAULT 0 AFTER protocolo_agendado_para,
    ADD COLUMN pedido_liberdade TINYINT(1) NOT NULL DEFAULT 0 AFTER pedido_urgencia;
