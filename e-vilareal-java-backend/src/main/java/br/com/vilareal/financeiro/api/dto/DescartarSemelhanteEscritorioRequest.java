package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class DescartarSemelhanteEscritorioRequest {

    @NotEmpty
    @Valid
    private List<DescartarSemelhanteEscritorioItemRequest> itens = new ArrayList<>();
}
