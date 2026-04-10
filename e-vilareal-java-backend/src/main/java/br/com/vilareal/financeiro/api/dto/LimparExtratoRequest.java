package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LimparExtratoRequest {

    @NotBlank(message = "banco é obrigatório.")
    private String banco;

    /** Nº do extrato no consolidado (ex.: CEF = 5). Opcional, mas recomendado — apaga tudo com esse número. */
    private Integer numeroBanco;
}
