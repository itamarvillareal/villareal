package br.com.vilareal.projudi.api.dto;

public record InicialDocumentoPessoaResponse(
        String p7sDriveFileId,
        Long pessoaId,
        String pessoaNome,
        String tipo,
        String nomeArquivo,
        int idArquivoTipo,
        String origem) {}
