package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DescartarRecorrenciaRequest {

    @NotBlank
    private String descricaoNorm;

    @NotNull
    private Integer numeroBanco;

    /** Se informados, descarta apenas o vínculo sugerido (padrão permanece). */
    private Long clienteId;

    private Long processoId;
}
