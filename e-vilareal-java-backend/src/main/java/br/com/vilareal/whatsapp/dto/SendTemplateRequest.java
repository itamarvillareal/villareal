package br.com.vilareal.whatsapp.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record SendTemplateRequest(
        @NotBlank String phoneNumber,
        @NotBlank String templateName,
        String languageCode,
        List<String> parameters) {}
