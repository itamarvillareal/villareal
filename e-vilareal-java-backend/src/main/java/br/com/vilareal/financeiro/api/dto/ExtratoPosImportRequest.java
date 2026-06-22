package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ExtratoPosImportRequest(
        @NotNull Integer numeroBanco,
        @NotEmpty List<Long> lancamentoIds,
        String origem) {}
