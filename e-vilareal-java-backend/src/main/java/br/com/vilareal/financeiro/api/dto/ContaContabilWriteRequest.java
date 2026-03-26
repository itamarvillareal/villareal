package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ContaContabilWriteRequest {

    @NotBlank(message = "codigo é obrigatório.")
    @Size(max = 4, message = "codigo deve ter no máximo 4 caracteres.")
    private String codigo;

    @NotBlank(message = "nome é obrigatório.")
    @Size(max = 255)
    private String nome;

    @NotNull(message = "ativo é obrigatório.")
    private Boolean ativo;

    @NotNull(message = "ordemExibicao é obrigatória.")
    private Integer ordemExibicao;
}
