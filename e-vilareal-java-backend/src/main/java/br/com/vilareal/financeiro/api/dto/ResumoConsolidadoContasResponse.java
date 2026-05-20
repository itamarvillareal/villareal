package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Getter
@Setter
public class ResumoConsolidadoContasResponse {

    /** Total de lançamentos por código de conta (A, B, …). */
    private Map<String, Long> totaisPorConta = new LinkedHashMap<>();

    /** Série mensal por conta nos últimos N meses. */
    private List<ResumoMensalContaResponse> meses = new ArrayList<>();
}
