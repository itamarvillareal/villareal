package br.com.vilareal.condominio.api.dto;

import java.util.List;

public record InadimplenciaExtracaoResponse(
        String clienteCodigo,
        String clienteNome,
        String condominioNome,
        String dataReferenciaPdf,
        List<InadimplenciaUnidadeDto> unidades,
        InadimplenciaResumoDto resumo) {}
