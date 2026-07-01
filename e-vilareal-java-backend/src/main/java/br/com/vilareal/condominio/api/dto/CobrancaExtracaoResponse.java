package br.com.vilareal.condominio.api.dto;

import br.com.vilareal.condominio.application.CobrancaUnidadeParsed;

import java.util.List;

public record CobrancaExtracaoResponse(
        List<CobrancaUnidadeParsed> unidades,
        CobrancaTotaisDto totais,
        String condominioNome,
        String dataReferencia,
        List<String> unidadesSemProprietario) {

    public CobrancaExtracaoResponse {
        if (unidadesSemProprietario == null) {
            unidadesSemProprietario = List.of();
        }
    }

    public CobrancaExtracaoResponse(
            List<CobrancaUnidadeParsed> unidades,
            CobrancaTotaisDto totais,
            String condominioNome,
            String dataReferencia) {
        this(unidades, totais, condominioNome, dataReferencia, List.of());
    }
}
