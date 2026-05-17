package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class ParearCompensacaoRequest {

    @NotEmpty
    @Valid
    private List<ParearCompensacaoItemRequest> pares;
}
