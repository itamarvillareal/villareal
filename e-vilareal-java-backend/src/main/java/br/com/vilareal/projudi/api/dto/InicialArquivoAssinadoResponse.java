package br.com.vilareal.projudi.api.dto;

public record InicialArquivoAssinadoResponse(
        Long arquivoId,
        Long peticaoId,
        int ordem,
        int idArquivoTipo,
        String nomeOriginal,
        String nomeP7s) {}
