package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.TipoMatchFatura;
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
public class CartaoBancoMapeamentoWriteRequest {

    @NotNull
    private Long cartaoId;

    @NotNull
    private Integer numeroBanco;

    @NotBlank
    @Size(max = 255)
    private String padraoDescricao;

    @NotNull
    private TipoMatchFatura tipoMatch;

    @NotNull
    @DecimalMin("0")
    @DecimalMax("1")
    private BigDecimal toleranciaValor;

    @NotNull
    private Integer toleranciaDias;

    @NotNull
    private Boolean ativo;
}
