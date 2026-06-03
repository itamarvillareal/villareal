package br.com.vilareal.condominio.api.dto;

public record RelatorioTotaisExecucaoDto(
        int unidadesProcessadas,
        int unidadesComErro,
        int titulosInseridos,
        int titulosIgnorados,
        int titulosFalhados,
        int processosCriados,
        int processosReutilizados,
        int pessoasCriadas,
        int revisoesTrocaDono) {}
