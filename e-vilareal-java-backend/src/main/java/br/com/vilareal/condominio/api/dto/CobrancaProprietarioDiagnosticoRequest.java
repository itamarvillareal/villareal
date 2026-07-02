package br.com.vilareal.condominio.api.dto;

import java.util.List;

public record CobrancaProprietarioDiagnosticoRequest(
        String clienteCodigo,
        List<CobrancaUnidadeRequestDto> unidades,
        List<UnidadePlanilhaLinhaDto> planilhaUnidades) {

    public CobrancaProprietarioDiagnosticoRequest {
        if (planilhaUnidades == null) {
            planilhaUnidades = List.of();
        }
    }
}
