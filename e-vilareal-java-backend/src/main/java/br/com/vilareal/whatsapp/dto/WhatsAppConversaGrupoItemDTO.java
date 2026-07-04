package br.com.vilareal.whatsapp.dto;

public record WhatsAppConversaGrupoItemDTO(
        String codigo, String nome, boolean automatico, boolean incluidoManual) {}
