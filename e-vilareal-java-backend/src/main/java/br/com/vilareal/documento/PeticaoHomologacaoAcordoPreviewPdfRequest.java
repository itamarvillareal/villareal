package br.com.vilareal.documento;

/** Prévia do PDF a partir do conteúdo editado na tela. */
public record PeticaoHomologacaoAcordoPreviewPdfRequest(
        PeticaoHomologacaoAcordoConteudoPreview conteudo, Long processoId) {}
