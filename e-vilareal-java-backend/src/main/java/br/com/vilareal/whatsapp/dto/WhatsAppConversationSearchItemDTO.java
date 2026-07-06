package br.com.vilareal.whatsapp.dto;

/** Resultado mínimo da busca de conversas por nome ou telefone parcial. */
public record WhatsAppConversationSearchItemDTO(String phoneNumber, String contactName) {}
