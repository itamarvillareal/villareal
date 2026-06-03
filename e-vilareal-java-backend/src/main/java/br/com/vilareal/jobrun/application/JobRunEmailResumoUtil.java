package br.com.vilareal.jobrun.application;

import br.com.vilareal.email.PublicacaoEmailProcessamentoResumo;

/** Métricas padrão para jobs de importação Gmail. */
public final class JobRunEmailResumoUtil {

    private JobRunEmailResumoUtil() {}

    public static void aplicarResumo(JobRunContext ctx, PublicacaoEmailProcessamentoResumo resumo) {
        if (ctx == null || resumo == null) {
            return;
        }
        ctx.setItemsProcessed(resumo.getPublicacoesProcessadas());
        ctx.setItemsFailed(resumo.getErros() != null ? resumo.getErros().size() : 0);
        ctx.putMetadata("emailsLidos", resumo.getEmailsLidos());
        ctx.putMetadata("publicacoesEncontradas", resumo.getPublicacoesEncontradas());
        ctx.putMetadata("processosUnicos", resumo.getProcessosUnicos());
        ctx.putMetadata("publicacoesDuplicadasIgnoradas", resumo.getPublicacoesDuplicadasIgnoradas());
        ctx.putMetadata("vinculosAutomaticos", resumo.getVinculosAutomaticos());
        ctx.putMetadata("forcarAtualizacao", resumo.isForcarAtualizacao());
        ctx.putMetadata("sincronizacaoIncremental", resumo.isSincronizacaoIncremental());
        if (resumo.getUltimaSincronizacaoGravada() != null) {
            ctx.putMetadata("ultimaSincronizacaoGravada", resumo.getUltimaSincronizacaoGravada().toString());
        }
    }
}
