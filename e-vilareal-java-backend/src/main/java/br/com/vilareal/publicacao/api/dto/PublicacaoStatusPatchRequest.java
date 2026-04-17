package br.com.vilareal.publicacao.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PublicacaoStatusPatchRequest {

    @NotBlank(message = "status é obrigatório.")
    private String status;

    private String observacao;
}
