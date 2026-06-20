package br.com.vilareal.financeiro.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class LancamentoCartaoWriteRequest {

    @NotNull(message = "cartaoId é obrigatório.")
    private Long cartaoId;

    @NotNull(message = "contaContabilId é obrigatório.")
    private Long contaContabilId;

    @Schema(description = "PK da tabela cliente; aceita pessoa.id legado via resolução no servidor")
    private Long clienteId;
    private Long processoId;

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
    private BigDecimal valor;

    @Size(max = 1)
    private String refTipo;

    @Size(max = 40)
    private String origem;

    @Size(max = 20)
    private String status;

    @Size(max = 20)
    private String etapa;

    @Size(max = 40)
    private String grupoCompensacao;
}
