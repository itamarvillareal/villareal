package br.com.vilareal.financeiro.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AplicarSugestaoLoteItemRequest {

    @NotNull
    private Long lancamentoId;

    @NotNull
    private Long contaContabilId;

    @Schema(description = "PK da tabela cliente; aceita pessoa.id legado via resolução no servidor")
    private Long clienteId;
    private Long processoId;
}
