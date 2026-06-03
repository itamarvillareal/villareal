package br.com.vilareal.condominio.api.dto;

import br.com.vilareal.condominio.application.CobrancaUnidadeParsed;

import java.util.List;

public record CobrancaExtracaoResponse(
        List<CobrancaUnidadeParsed> unidades,
        CobrancaTotaisDto totais,
        String condominioNome,
        String dataReferencia) {}
