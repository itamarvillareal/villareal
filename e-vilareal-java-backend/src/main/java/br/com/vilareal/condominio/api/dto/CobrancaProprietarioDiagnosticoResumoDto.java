package br.com.vilareal.condominio.api.dto;

public record CobrancaProprietarioDiagnosticoResumoDto(
        int totalUnidades,
        int mesmoReu,
        int trocaDono,
        int exDonoLegado,
        int coproprietarios,
        int semProprietario,
        int semLegado,
        int cpfCorrigido) {}
