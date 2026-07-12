package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** Marca/desmarca conferência de lançamentos por id (Etapa 5b). */
@Getter
@Setter
public class AcertoConferirRequest {

    @NotEmpty
    private List<Long> lancamentoIds;

    @NotNull
    private Boolean conferido;
}
