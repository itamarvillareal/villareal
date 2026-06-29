package br.com.vilareal.whatsapp.dto;

public record AniversarioStatsDTO(
        long enviadosEsteAno,
        long enviadosEsteMes,
        int proximosSeteDias,
        int aniversariantesSemTelefone) {}
