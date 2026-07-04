package br.com.vilareal.whatsapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SendTextRequest(
        @NotBlank String phoneNumber,
        @NotBlank @Size(max = 4096) String message,
        Long clienteId,
        Long processoId) {}
