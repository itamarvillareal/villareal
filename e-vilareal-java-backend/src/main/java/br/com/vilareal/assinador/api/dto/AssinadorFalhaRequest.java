package br.com.vilareal.assinador.api.dto;

import jakarta.validation.constraints.NotBlank;

public record AssinadorFalhaRequest(@NotBlank String codigo, @NotBlank String mensagem) {}
