package br.com.vilareal.whatsapp.dto;

public record IniciarTelefoneItemDTO(
        String numeroCanonico,
        String label,
        boolean principal,
        String contactName) {}
