package br.com.vilareal.documento.importacao;

/** Status da fila de importação de contratos de honorários celebrados. */
public enum ContratoHonorariosImportacaoStatus {
    AGUARDANDO_EXTRACAO,
    EXTRAIDO,
    EM_REVISAO,
    APROVADO,
    REJEITADO,
    REVERTIDO,
    PENDENTE_LIMITE,
    ERRO_EXTRACAO
}
