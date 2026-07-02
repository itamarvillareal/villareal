package br.com.vilareal.condominio.api.dto;

public record CobrancaProprietarioLegadoProcDto(
        int numeroInterno, long processoId, String reuNome, String reuDoc, boolean parcelamentoAceito) {}
