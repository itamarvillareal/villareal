package br.com.vilareal.pessoa.api.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ClienteProprioPatchRequest {
    @NotNull
    private Boolean proprio;
}
