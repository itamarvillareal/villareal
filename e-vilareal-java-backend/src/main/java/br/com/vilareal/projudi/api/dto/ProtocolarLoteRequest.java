package br.com.vilareal.projudi.api.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ProtocolarLoteRequest(
        @NotEmpty List<Long> peticaoIds,
        @NotNull Boolean confirmar) {}
