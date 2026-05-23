package br.com.vilareal.documento;

public record DriveArquivoDto(
        String id,
        String nome,
        String tipo,
        String mimeType,
        Long tamanho,
        String dataModificacao,
        String webViewLink,
        String webContentLink,
        String iconLink) {}
