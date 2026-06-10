package br.com.vilareal.projudi.api.dto;

import jakarta.validation.constraints.NotBlank;

public record ValidarProtocoloRequest(@NotBlank String numeroProcesso) {}
