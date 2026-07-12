package br.com.vilareal.financeiro.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class EloCompensacaoResponse {

    @Schema(description = "Identificador numérico do elo (col. M / Conta Compensação)")
    private String elo;

    @Schema(
            description =
                    "Lançamentos ATIVO do elo, priorizando CONTA ZERO (19) e ocultando lados legados 9/17/18 substituídos")
    private List<LancamentoFinanceiroResponse> lancamentos = new ArrayList<>();
}
