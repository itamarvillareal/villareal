package br.com.vilareal.whatsapp.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record RecorrenciaMensalRequest(
        @Min(1) @Max(31) int diaDoMes,
        @Min(0) @Max(23) int hora,
        @Min(0) @Max(59) int minuto,
        @NotBlank String mesInicio,
        @NotBlank String mesFim) {}
