package br.com.vilareal.condominio.api.dto;

public record RelatorioCabecalhoDto(
        String importacaoId,
        String criadoEmIso,
        String clienteCodigo,
        String clienteNome,
        String arquivoNome,
        String usuario) {}
