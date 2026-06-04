package br.com.vilareal.condominio.api.dto;

/** Agregado da regra D+T aplicada na execução (sem listagem de devedores descartados). */
public record RelatorioRegraInicioDto(
        String regraAplicada,
        String dataImportacao,
        int devedoresDescartados,
        int titulosDescartados) {}
