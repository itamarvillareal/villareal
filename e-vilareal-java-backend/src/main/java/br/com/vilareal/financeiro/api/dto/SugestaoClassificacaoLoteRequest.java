package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class SugestaoClassificacaoLoteRequest {

    @NotEmpty
    @Size(max = 50)
    private List<Long> lancamentoIds;
}
