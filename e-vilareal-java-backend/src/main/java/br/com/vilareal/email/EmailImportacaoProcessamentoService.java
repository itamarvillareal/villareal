package br.com.vilareal.email;

import br.com.vilareal.email.dto.EmailProcessamentoIniciadoResponse;
import br.com.vilareal.jobrun.application.JobRunEmailResumoUtil;
import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Instant;

@Service
public class EmailImportacaoProcessamentoService {

    private static final Logger log = LoggerFactory.getLogger(EmailImportacaoProcessamentoService.class);

    private final GmailProjudiManifestacaoService gmailProjudiManifestacaoService;
    private final GmailTrtPushManifestacaoService gmailTrtPushManifestacaoService;
    private final GmailCaixaOrdemService gmailCaixaOrdemService;
    private final JobRunTracker jobRunTracker;

    public EmailImportacaoProcessamentoService(
            GmailProjudiManifestacaoService gmailProjudiManifestacaoService,
            GmailTrtPushManifestacaoService gmailTrtPushManifestacaoService,
            GmailCaixaOrdemService gmailCaixaOrdemService,
            JobRunTracker jobRunTracker) {
        this.gmailProjudiManifestacaoService = gmailProjudiManifestacaoService;
        this.gmailTrtPushManifestacaoService = gmailTrtPushManifestacaoService;
        this.gmailCaixaOrdemService = gmailCaixaOrdemService;
        this.jobRunTracker = jobRunTracker;
    }

    private void atualizarOrdemCaixaAposSync() {
        try {
            gmailCaixaOrdemService.atualizarOrdemCaixaInbox();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (RuntimeException e) {
            // Importação já concluída; ordem da caixa pode ser atualizada depois sem falhar o job.
            log.warn("Ordem caixa Gmail não atualizada após sync: {}", e.getMessage());
        }
    }

    public PublicacaoEmailProcessamentoResumo processarProjudi(
            boolean forcarAtualizacaoCompleta, Instant desdeOverride) {
        String jobName = forcarAtualizacaoCompleta ? JobNames.GMAIL_PROJUDI_COMPLETO : JobNames.GMAIL_PROJUDI;
        return jobRunTracker.runTrackedJob(jobName, ctx -> {
            ctx.putMetadata("trigger", "manual");
            try {
                PublicacaoEmailProcessamentoResumo resumo =
                        gmailProjudiManifestacaoService.buscarEProcessarManifestacoesManual(
                                forcarAtualizacaoCompleta, desdeOverride);
                JobRunEmailResumoUtil.aplicarResumo(ctx, resumo);
                atualizarOrdemCaixaAposSync();
                return resumo;
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        });
    }

    public EmailProcessamentoIniciadoResponse enfileirarProjudi(
            boolean forcarAtualizacaoCompleta, Instant desdeOverride) {
        String jobName = JobNames.GMAIL_PROJUDI_COMPLETO;
        Long runId =
                jobRunTracker.submitAsyncJob(jobName, ctx -> {
                    ctx.putMetadata("trigger", "manual-async");
                    try {
                        PublicacaoEmailProcessamentoResumo resumo =
                                gmailProjudiManifestacaoService.buscarEProcessarManifestacoesManual(
                                        forcarAtualizacaoCompleta, desdeOverride);
                        JobRunEmailResumoUtil.aplicarResumo(ctx, resumo);
                        atualizarOrdemCaixaAposSync();
                    } catch (IOException e) {
                        throw new UncheckedIOException(e);
                    }
                });
        return respostaAsync(runId, jobName, "PROJUDI", true);
    }

    public PublicacaoEmailProcessamentoResumo processarTrt(
            boolean forcarAtualizacaoCompleta, Instant desdeOverride) {
        String jobName = forcarAtualizacaoCompleta ? JobNames.GMAIL_TRT_COMPLETO : JobNames.GMAIL_TRT;
        return jobRunTracker.runTrackedJob(jobName, ctx -> {
            ctx.putMetadata("trigger", "manual");
            try {
                PublicacaoEmailProcessamentoResumo resumo =
                        gmailTrtPushManifestacaoService.buscarEProcessarManifestacoesManual(
                                forcarAtualizacaoCompleta, desdeOverride);
                JobRunEmailResumoUtil.aplicarResumo(ctx, resumo);
                atualizarOrdemCaixaAposSync();
                return resumo;
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        });
    }

    public EmailProcessamentoIniciadoResponse enfileirarTrt(
            boolean forcarAtualizacaoCompleta, Instant desdeOverride) {
        String jobName = JobNames.GMAIL_TRT_COMPLETO;
        Long runId =
                jobRunTracker.submitAsyncJob(jobName, ctx -> {
                    ctx.putMetadata("trigger", "manual-async");
                    try {
                        PublicacaoEmailProcessamentoResumo resumo =
                                gmailTrtPushManifestacaoService.buscarEProcessarManifestacoesManual(
                                        forcarAtualizacaoCompleta, desdeOverride);
                        JobRunEmailResumoUtil.aplicarResumo(ctx, resumo);
                        atualizarOrdemCaixaAposSync();
                    } catch (IOException e) {
                        throw new UncheckedIOException(e);
                    }
                });
        return respostaAsync(runId, jobName, "TRT", true);
    }

    private static EmailProcessamentoIniciadoResponse respostaAsync(
            Long runId, String jobName, String fonte, boolean forcar) {
        EmailProcessamentoIniciadoResponse r = new EmailProcessamentoIniciadoResponse();
        r.setJobRunId(runId);
        r.setJobName(jobName);
        r.setFonte(fonte);
        r.setForcarAtualizacao(forcar);
        return r;
    }
}
