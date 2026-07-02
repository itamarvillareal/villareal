package br.com.vilareal.condominio.api.dto;

import java.util.List;

public record CobrancaProprietarioDiagnosticoItemDto(
        String codigoUnidade,
        String classe,
        String proprietarioEfetivoNome,
        String proprietarioEfetivoDoc,
        String fonteProprietario,
        String proprietarioLegadoNome,
        String proprietarioLegadoDoc,
        List<CobrancaProprietarioLegadoProcDto> processosLegado,
        List<String> coproprietariosPlanilha,
        String mensagem,
        boolean acaoAutomaticaOk) {}
