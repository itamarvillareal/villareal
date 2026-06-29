package br.com.vilareal.whatsapp.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

/**
 * Request para criação de template na Meta.
 */
public record CreateTemplateRequest(
        @NotBlank String name,
        @NotBlank String category,
        @NotBlank String bodyText,
        List<String> exampleValues) {}
