package br.com.vilareal.documento.importacao.api.dto;

import java.math.BigDecimal;

public record CensoHonorariosRelatorioResponse(
        int totalImportados,
        int totalAprovados,
        int totalRejeitados,
        int totalRevertidos,
        BigDecimal recebivelConfirmado,
        BigDecimal passivoIdentificado,
        BigDecimal expectativaContingente,
        int contratosComCobrancaArmada) {}
