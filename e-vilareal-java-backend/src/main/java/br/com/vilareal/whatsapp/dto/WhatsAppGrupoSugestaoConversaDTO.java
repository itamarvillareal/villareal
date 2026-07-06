package br.com.vilareal.whatsapp.dto;

public record WhatsAppGrupoSugestaoConversaDTO(
        String phoneNumber,
        String contactName,
        boolean suggested,
        boolean included) {}
