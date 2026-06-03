package br.com.vilareal.condominio.api.dto;

public record CobrancaProcessarItemDto(
        String codigoUnidade,
        long processoId,
        int numeroInterno,
        boolean processoCriado,
        int debitosInseridos,
        int debitosIgnorados,
        int dimensao,
        boolean revisaoTrocaDono) {}
