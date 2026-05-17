package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LimparExtratoCartaoRequest {

    @NotBlank(message = "cartao é obrigatório.")
    private String cartao;

    private Integer numeroCartao;
}
