package br.com.vilareal.publicacao.application.event;

/** Publicação vinculada a um processo ({@code patchVinculoProcesso}) — gatilho pós-commit da triagem Júlia. */
public record PublicacaoVinculadaEvent(Long publicacaoId, Long processoId) {}
