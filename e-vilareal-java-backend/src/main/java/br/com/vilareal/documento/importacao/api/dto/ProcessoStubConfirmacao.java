package br.com.vilareal.documento.importacao.api.dto;

public record ProcessoStubConfirmacao(
        String codigoCliente, Integer numeroInterno, String numeroCnj, String descricao, Long pessoaId) {}
