package br.com.vilareal.whatsapp.dto;

import java.util.List;

/** Resposta agregada do encaminhamento. */
public record WhatsAppForwardMessageResponse(boolean success, List<WhatsAppForwardDestinationResult> results) {}
