package br.com.vilareal.calculo.api.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

public record AcordoDescumpridoProporResponse(
        int dimensaoNova,
        String chaveRodada,
        JsonNode rodada,
        List<ParcelaConvertidaResumo> parcelasConvertidas,
        long totalPrincipalCentavos) {

    public record ParcelaConvertidaResumo(
            int parcelaNumero, String dataVencimento, long valorCentavos, long honorariosCentavos) {}
}
