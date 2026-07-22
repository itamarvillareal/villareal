package br.com.vilareal.projudi.api.dto;

public record InicialDocumentoPessoaResponse(
        Long documentoId,
        Long pessoaId,
        String pessoaNome,
        String tipo,
        String nomeArquivo,
        int idArquivoTipo,
        String origem) {}
