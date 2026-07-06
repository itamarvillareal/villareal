-- Grupos WhatsApp passam a ser criados manualmente pelo usuário.
-- Remove vínculos automáticos e overrides EXCLUIR (não há mais camada auto).

DELETE FROM whatsapp_conversa_cliente;

DELETE FROM whatsapp_conversa_cliente_manual
WHERE acao = 'EXCLUIR';
