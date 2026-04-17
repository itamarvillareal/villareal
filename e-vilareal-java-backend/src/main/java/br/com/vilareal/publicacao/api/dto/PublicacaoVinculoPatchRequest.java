package br.com.vilareal.publicacao.api.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PublicacaoVinculoPatchRequest {

    @NotNull(message = "processoId é obrigatório.")
    private Long processoId;

    private String observacao;
}
