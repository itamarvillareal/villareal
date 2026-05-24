package br.com.vilareal.whatsapp.dto;

public record WhatsAppStatsDTO(long sentToday, long receivedToday, long scheduledPending, long failedToday) {}
