package br.com.vilareal.documento.importacao.api.dto;

import java.util.List;

public record ContratoHonorariosArmarCobrancaRequest(
        List<Long> contratoHonorariosIds,
        String whatsappHorario,
        String whatsappAntecedencia) {}
