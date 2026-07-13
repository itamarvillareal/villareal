-- Mensagens inbound que a Cloud API não entrega (webhook type=unsupported: visualização única,
-- enquete, GIF etc.) eram gravadas como UNKNOWN com o texto genérico "📩 Mídia recebida",
-- sem media_id — impossíveis de abrir. Reclassifica como UNSUPPORTED com aviso claro.
UPDATE whatsapp_messages
SET message_type = 'UNSUPPORTED',
    content = '🚫 Conteúdo não suportado pelo WhatsApp Business — peça ao contato para reenviar como mensagem comum.'
WHERE direction = 'INBOUND'
  AND message_type = 'UNKNOWN'
  AND media_id IS NULL
  AND content LIKE '%Mídia recebida%';
