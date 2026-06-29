package br.com.vilareal.projudi.api.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProjudiAssuntoCadastroRequest(
        @Min(1) int idAssunto, @NotBlank @Size(max = 500) String descricao) {}
