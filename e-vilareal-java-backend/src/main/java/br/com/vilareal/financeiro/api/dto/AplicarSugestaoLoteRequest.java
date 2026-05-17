package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class AplicarSugestaoLoteRequest {

    @NotEmpty
    private List<AplicarSugestaoLoteItemRequest> aplicacoes;
}
