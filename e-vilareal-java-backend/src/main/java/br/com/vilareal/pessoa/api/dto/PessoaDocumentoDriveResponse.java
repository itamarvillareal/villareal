package br.com.vilareal.pessoa.api.dto;

import java.time.Instant;

public record PessoaDocumentoDriveResponse(
        Long id,
        Long pessoaId,
        String tipo,
        String nomeArquivo,
        String driveFileId,
        String p7sDriveFileId,
        String pdfSha256,
        String p7sSha256,
        String mimeType,
        Instant createdAt) {}
