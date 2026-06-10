package br.com.vilareal.projudi.api.dto;

import jakarta.validation.constraints.NotNull;

public record AtualizarCredencialPeticaoRequest(@NotNull Long credencialId) {}
