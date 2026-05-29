package br.com.vilareal.demanda.api.dto;

import jakarta.validation.constraints.NotBlank;

public record DemandaStatusRequest(@NotBlank String status) {}
