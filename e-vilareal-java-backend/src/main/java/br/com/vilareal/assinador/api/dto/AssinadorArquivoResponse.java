package br.com.vilareal.assinador.api.dto;

public record AssinadorArquivoResponse(
        Long arquivoId,
        Long peticaoId,
        int ordem,
        String nomeCanonicoPdf,
        String nomeCanonicoP7s,
        String pdfSha256) {}
