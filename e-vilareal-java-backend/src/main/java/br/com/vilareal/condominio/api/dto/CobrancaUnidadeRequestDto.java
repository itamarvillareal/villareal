package br.com.vilareal.condominio.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CobrancaUnidadeRequestDto(
        @NotBlank String codigoUnidadeNormalizada,
        @NotBlank String proprietarioNome,
        @NotBlank String proprietarioDocDigitos,
        @NotNull List<InadimplenciaCobrancaDto> cobrancas) {}
