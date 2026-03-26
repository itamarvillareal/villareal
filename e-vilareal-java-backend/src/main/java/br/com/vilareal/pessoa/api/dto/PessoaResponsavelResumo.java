package br.com.vilareal.pessoa.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Resumo do responsável (outra pessoa)")
public record PessoaResponsavelResumo(
        @Schema(description = "ID da pessoa responsável") Long id,
        @Schema(description = "Nome") String nome
) {
}
