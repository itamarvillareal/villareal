package br.com.vilareal.condominio.api.dto;

import java.util.List;

/**
 * Item por unidade no relatório — mantém campos legados do front ({@code debitosInseridos}, etc.)
 * e detalhes de títulos inseridos/ignorados.
 */
public record RelatorioItemUnidadeDto(
        String codigoUnidade,
        String proprietarioNome,
        String doc,
        boolean pessoaCriada,
        long processoId,
        int numeroInterno,
        boolean processoCriado,
        int titulosNaUnidade,
        int debitosInseridos,
        int debitosIgnorados,
        int dimensao,
        boolean revisaoTrocaDono,
        Long pessoaIdReuAnterior,
        List<RelatorioDebitoInseridoDto> inseridos,
        List<RelatorioDebitoIgnoradoDto> ignorados) {}
