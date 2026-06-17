package br.com.vilareal.documento.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record DocumentoModeloWriteRequest(
        @NotBlank @Size(max = 120) String label,
        @NotNull Long usuarioResponsavelId,
        @NotBlank @Size(max = 255) String advogadoNome,
        @NotBlank @Size(max = 80) String advogadoOab,
        @NotBlank String rodapeTexto,
        Boolean ativo,
        Boolean removerCabecalho) {}
