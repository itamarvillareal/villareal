package br.com.vilareal.condominio.api.dto;

public record InadimplenciaImportItemResultadoDto(
        String codigoUnidade,
        Integer numeroInterno,
        Long processoId,
        boolean processoCriado,
        int cobrancasLancadas) {}
