package br.com.vilareal.documento;

/**
 * Metadados de navegação de uma pasta do Drive: a própria pasta e o pai imediato
 * (quando navegável; nulo ao atingir a fronteira da pasta de clientes/raiz).
 */
public record DrivePastaInfoDto(String id, String nome, String paiId, String paiNome) {}
