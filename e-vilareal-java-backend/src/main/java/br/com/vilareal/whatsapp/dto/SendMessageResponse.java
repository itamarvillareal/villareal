package br.com.vilareal.whatsapp.dto;

public record SendMessageResponse(boolean success, String messageId, String error) {}
