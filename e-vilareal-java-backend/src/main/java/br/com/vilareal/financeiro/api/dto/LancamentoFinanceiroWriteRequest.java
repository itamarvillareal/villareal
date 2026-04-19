package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class LancamentoFinanceiroWriteRequest {

    @NotNull(message = "contaContabilId é obrigatório.")
    private Long contaContabilId;

    private Long clienteId;
    private Long processoId;

    @Size(max = 120)
    private String bancoNome;

    private Integer numeroBanco;

    @NotBlank(message = "numeroLancamento é obrigatório.")
    @Size(max = 80)
    private String numeroLancamento;

    @NotNull(message = "dataLancamento é obrigatória.")
    private LocalDate dataLancamento;

    private LocalDate dataCompetencia;

    @NotBlank(message = "descricao é obrigatória.")
    @Size(max = 500)
    private String descricao;

    @Size(max = 2000)
    private String descricaoDetalhada;

    @NotNull(message = "valor é obrigatório.")
    @DecimalMin(value = "0.0", inclusive = true, message = "valor não pode ser negativo.")
    private BigDecimal valor;

    @NotNull(message = "natureza é obrigatória.")
    private NaturezaLancamento natureza;

    /** N ou R; omitido ou vazio vira N. */
    @Size(max = 1)
    private String refTipo;

    @Size(max = 40)
    private String origem;

    @Size(max = 20)
    private String status;
}
