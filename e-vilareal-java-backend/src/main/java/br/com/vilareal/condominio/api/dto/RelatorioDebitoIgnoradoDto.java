package br.com.vilareal.condominio.api.dto;

public record RelatorioDebitoIgnoradoDto(
        String vencimento, String valor, int dimensaoExistente, String motivo) {}
