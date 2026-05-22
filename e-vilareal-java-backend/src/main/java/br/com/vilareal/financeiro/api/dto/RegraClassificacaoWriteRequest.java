package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.TipoMatch;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

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

    @Size(max = 1)
    private String letraDestino;

    private Integer numeroBanco;

    @NotNull
    private Integer prioridade;

    @NotNull
    @DecimalMin("0")
    @DecimalMax("1")
    private BigDecimal confianca;

    @NotNull
    private Boolean ativo;

    @io.swagger.v3.oas.annotations.media.Schema(
            description = "PK da tabela cliente; aceita pessoa.id legado via resolução no servidor")
    private Long clienteId;
    private Long processoId;
}
