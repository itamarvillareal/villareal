package br.com.vilareal.condominio.api.dto;

import java.util.List;

public record UnidadesPessoasImportResponse(
        String importacaoId,
        int pessoasCriadas,
        int pessoasReutilizadas,
        int contatosAdicionados,
        int enderecosAdicionados,
        int processosEncontrados,
        int partesProprietarioCriadas,
        int partesProprietarioJaExistentes,
        int inquilinosMesclados,
        List<UnidadesPessoasImportErroDto> erros) {}
