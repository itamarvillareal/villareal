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
    private IndicadorSaude naoIdentificados = new IndicadorSaude();
    @JsonProperty("aSemCliente")
    private IndicadorSaude aSemCliente = new IndicadorSaude();
    private long gruposInconsistentes;
    private long paresOrfaosSugeridos;
    private List<MesAbertoResponse> mesesAbertos = new ArrayList<>();
    private String atualizadoEm;

    @Getter
    @Setter
    public static class IndicadorSaude {
        private long total;
        private double percentual;
    }

    @Getter
    @Setter
    public static class MesAbertoResponse {
        private int ano;
        private int mes;
        private long pendentes;
        private long total;
        private double percentualCompleto;
    }
}
