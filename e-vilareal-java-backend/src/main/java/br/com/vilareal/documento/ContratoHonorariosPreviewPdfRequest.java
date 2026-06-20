package br.com.vilareal.documento;

/** Gera PDF de prévia a partir do conteúdo editado (sem gravar no Drive). */
public record ContratoHonorariosPreviewPdfRequest(
        ContratoHonorariosConteudoPreview conteudo, Long processoId) {}
