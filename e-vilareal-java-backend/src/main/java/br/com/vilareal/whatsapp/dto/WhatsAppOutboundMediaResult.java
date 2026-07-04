package br.com.vilareal.whatsapp.dto;

import br.com.vilareal.whatsapp.WhatsAppMediaStatus;

/**
 * Resultado do envio outbound de mídia (Meta confirmou + linha persistida).
 */
public record WhatsAppOutboundMediaResult(
        Long messageId, String waMessageId, WhatsAppMediaStatus mediaStatus) {}
