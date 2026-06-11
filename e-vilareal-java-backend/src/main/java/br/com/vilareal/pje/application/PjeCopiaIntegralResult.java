package br.com.vilareal.pje.application;

import br.com.vilareal.pje.domain.PjeGrau;

public record PjeCopiaIntegralResult(
        PjeGrau grau,
        String numeroCnj,
        boolean sucesso,
        String driveFileId,
        String nomeArquivo,
        String pastaMovimentacoesId,
        String mensagem) {

    public static PjeCopiaIntegralResult sucesso(
            PjeGrau grau, String cnj, String driveFileId, String nomeArquivo, String pastaMovimentacoesId) {
        return new PjeCopiaIntegralResult(
                grau,
                cnj,
                true,
                driveFileId,
                nomeArquivo,
                pastaMovimentacoesId,
                "Cópia integral arquivada no Drive.");
    }

    public static PjeCopiaIntegralResult falha(PjeGrau grau, String cnj, String mensagem) {
        return new PjeCopiaIntegralResult(grau, cnj, false, null, null, null, mensagem);
    }
}
