package br.com.vilareal.condominio.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CobrancaProcessarRequest(
        @NotBlank String clienteCodigo,
        @NotNull List<CobrancaUnidadeRequestDto> unidades,
        String arquivoNome) {}
