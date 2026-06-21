package br.com.vilareal.financeiro.application.cora;

/** Linha de auditoria da migração Lote A. */
public record CoraDuplicataMigracaoAuditoriaLinha(
        Long planilhaId,
        Long ofxId,
        String tabela,
        String campo,
        String valorAntes,
        String valorDepois) {}
