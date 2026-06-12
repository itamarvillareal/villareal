package br.com.vilareal.processo.api.dto;

/**
 * Resultado do botão «Obter movimentações» — roteado por {@code processo.tramitacao}.
 */
public record ProcessoMovimentacoesDriveResponse(
        String tramitacao,
        /** CONCLUIDO, INICIADO, PJE_AUTOMACAO_INDISPONIVEL, SEM_SISTEMA */
        String status,
        Integer arquivosBaixados,
        Integer totalComDocumento,
        Integer totalArquivadasDrive,
        Boolean temMais,
        String mensagem,
        String selecaoResumo,
        String erro) {

    public static ProcessoMovimentacoesDriveResponse fromProjudi(
            String tramitacao, ProcessoProjudiMovimentacoesDriveResponse projudi) {
        return new ProcessoMovimentacoesDriveResponse(
                tramitacao,
                "CONCLUIDO",
                projudi.arquivosBaixados(),
                projudi.totalComDocumento(),
                projudi.totalArquivadasDrive(),
                projudi.temMais(),
                projudi.mensagem(),
                projudi.selecaoResumo(),
                projudi.erro());
    }

    public static ProcessoMovimentacoesDriveResponse pjeIniciado(String tramitacao) {
        return new ProcessoMovimentacoesDriveResponse(
                tramitacao,
                "INICIADO",
                null,
                null,
                null,
                null,
                "PJe iniciado — acompanhe o badge No Drive na publicação por e-mail.",
                null,
                null);
    }

    public static ProcessoMovimentacoesDriveResponse semSistema(String tramitacao, String mensagem) {
        return new ProcessoMovimentacoesDriveResponse(
                tramitacao, "SEM_SISTEMA", null, null, null, null, mensagem, null, mensagem);
    }

    public static ProcessoMovimentacoesDriveResponse pjeAutomacaoIndisponivel(
            String tramitacao, String mensagem) {
        return new ProcessoMovimentacoesDriveResponse(
                tramitacao,
                "PJE_AUTOMACAO_INDISPONIVEL",
                null,
                null,
                null,
                null,
                mensagem,
                null,
                mensagem);
    }
}
