package br.com.vilareal.pessoa.application;

/**
 * Arquivo .p7s encontrado na pasta Pessoas do Google Drive (consulta em tempo real, sem depender do banco).
 */
public record PessoaP7sDriveItem(
        String p7sDriveFileId,
        String nomeArquivo,
        String pdfDriveFileId,
        String tipoPasta) {}
