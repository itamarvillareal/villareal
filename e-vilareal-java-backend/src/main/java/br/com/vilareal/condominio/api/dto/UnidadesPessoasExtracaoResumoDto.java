package br.com.vilareal.condominio.api.dto;

public record UnidadesPessoasExtracaoResumoDto(
        int linhasLidas,
        int unidadesDistintas,
        int linhasComProprietarioCpfValido,
        int linhasComInquilinoCpfValido,
        int cpfsProprietariosDistintosValidos,
        int cpfsInquilinosDistintosValidos,
        int pessoasProprietarioJaCadastradas,
        int pessoasProprietarioNovasEstimadas,
        int pessoasInquilinoJaCadastradas,
        int pessoasInquilinoNovasEstimadas) {}
