package br.com.vilareal.pessoa.api.dto;

/** Result of POST /api/clientes: new row or existing same codigo+pessoa. */
public record ClienteCreateResult(ClienteListItemResponse cliente, boolean criadoNovo) {}