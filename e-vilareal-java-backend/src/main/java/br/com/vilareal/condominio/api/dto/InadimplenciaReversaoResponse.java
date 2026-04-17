package br.com.vilareal.condominio.api.dto;

public record InadimplenciaReversaoResponse(
        String importacaoId,
        long andamentosRemovidos,
        long calculosRemovidos,
        long partesRemovidas,
        long processosRemovidos,
        long contatosRemovidos,
        long enderecosRemovidos,
        long pessoasRemovidas) {}
