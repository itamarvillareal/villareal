package br.com.vilareal.imovel.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record DespesaCondominioConfirmarRequest(@NotBlank String obrigacaoChave, @NotNull Long imovelId) {}
