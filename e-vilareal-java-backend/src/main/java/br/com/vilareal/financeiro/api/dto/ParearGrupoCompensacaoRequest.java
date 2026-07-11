package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Pareamento em grupo (1:N): compensa N lançamentos sob o mesmo {@code grupo_compensacao}.
 * Em conta de acerto ({@code exige_soma_zero}) a soma assinada deve ser exatamente 0 e todos os
 * lançamentos devem ter o mesmo vínculo (cliente ou pessoa/imóvel).
 */
@Getter
@Setter
public class ParearGrupoCompensacaoRequest {

    @NotEmpty(message = "lancamentoIds é obrigatório.")
    private List<Long> lancamentoIds;

    /** Opcional; se omitido, o backend gera (COMP-xxxxxxxx). */
    @Size(max = 40)
    private String grupoCompensacao;
}
