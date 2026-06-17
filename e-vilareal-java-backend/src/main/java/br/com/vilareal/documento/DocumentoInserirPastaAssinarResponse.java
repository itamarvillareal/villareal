package br.com.vilareal.documento;

public record DocumentoInserirPastaAssinarResponse(
        Long processoId, String fase, String driveFileIdAssinar, String driveFileIdPeticoes, String nomeArquivo) {}
