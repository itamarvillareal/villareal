package br.com.vilareal.condominio.api.dto;

import java.util.List;

public record UnidadesPessoasExtracaoResponse(
        String clienteCodigo,
        String clienteNome,
        UnidadesPessoasExtracaoResumoDto resumo,
        List<UnidadePlanilhaLinhaDto> unidades) {}
