package br.com.vilareal.email;

/**
 * Anexo baixado do Gmail (nome original + conteúdo binário).
 */
public record GmailAnexoArquivo(String filename, byte[] conteudo) {}
