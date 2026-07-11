-- Registro do aviso de processo novo enviado ao cliente (Parte 5, Bloco E).
-- Um aviso por descoberto: com aviso_enviado_em preenchido, o backend RECUSA reenvio.
-- A auditoria da mensagem em si (wamid, status de entrega) fica na tabela whatsapp_message,
-- gravada pelo WhatsAppService.persistOutboundMessage — aqui é só o vínculo e o dedupe.
ALTER TABLE processo_descoberto
    ADD COLUMN aviso_enviado_em DATETIME(3) NULL,
    ADD COLUMN aviso_enviado_para VARCHAR(30) NULL;
