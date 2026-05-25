package br.com.vilareal.financeiro.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Getter
@Setter
public class FinanceiroSaudeResponse {
    private long totalLancamentos;
    private long totalCartao;
    private Map<String, Long> porEtapa = new LinkedHashMap<>();
    private FinanceiroSaudeIndicadorDto naoIdentificados = new FinanceiroSaudeIndicadorDto();
    @JsonProperty("aSemCliente")
    private FinanceiroSaudeIndicadorDto aSemCliente = new FinanceiroSaudeIndicadorDto();
    private long gruposInconsistentes;
    private long paresOrfaosSugeridos;
    private List<FinanceiroSaudeMesAbertoDto> mesesAbertos = new ArrayList<>();
    private String atualizadoEm;
}
