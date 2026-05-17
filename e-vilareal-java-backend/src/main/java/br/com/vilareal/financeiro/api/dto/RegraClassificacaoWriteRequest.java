package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.TipoMatch;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegraClassificacaoWriteRequest {

    @NotBlank
    @Size(max = 255)
    private String padraoDescricao;

    @NotNull
    private TipoMatch tipoMatch;

    @NotNull
    private Long contaContabilId;

    private Integer numeroBanco;

    @NotNull
    private Integer prioridade;

    @NotNull
    private Boolean ativo;

    private Long clienteId;
    private Long processoId;
}
