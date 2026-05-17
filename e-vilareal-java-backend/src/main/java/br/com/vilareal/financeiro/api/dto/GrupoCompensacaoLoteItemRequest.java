package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GrupoCompensacaoLoteItemRequest {

    @NotBlank
    @Size(max = 80)
    private String numeroLancamento;

    @Size(max = 40)
    private String grupoCompensacao;
}
