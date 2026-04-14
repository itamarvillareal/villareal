package br.com.vilareal.condominio.api.dto;

import java.util.List;

public record InadimplenciaImportResponse(
        String importacaoId,
        int processosCriados,
        int cobrancasLancadasTotal,
        List<InadimplenciaImportItemResultadoDto> itens,
        List<InadimplenciaImportErroDto> erros) {}
