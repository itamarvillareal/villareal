package br.com.vilareal.condominio.api.dto;

import java.util.List;

public record CobrancaProprietarioDiagnosticoResponse(
        List<CobrancaProprietarioDiagnosticoItemDto> itens, CobrancaProprietarioDiagnosticoResumoDto resumo) {}
