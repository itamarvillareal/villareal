package br.com.vilareal.email;

import br.com.vilareal.email.dto.EmailImportacaoSyncStatusResponse;
import br.com.vilareal.jobrun.application.JobRunEmailResumoUtil;
import br.com.vilareal.jobrun.application.JobRunTracker;
import br.com.vilareal.jobrun.domain.JobNames;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/email/projudi")
@Tag(name = "Email — Manifestações Projudi TJGO")
public class ProjudiEmailController {

    private final GmailProjudiManifestacaoService gmailProjudiManifestacaoService;
    private final EmailImportacaoSyncService emailImportacaoSyncService;
    private final JobRunTracker jobRunTracker;

    public ProjudiEmailController(
            GmailProjudiManifestacaoService gmailProjudiManifestacaoService,
            EmailImportacaoSyncService emailImportacaoSyncService,
            JobRunTracker jobRunTracker) {
        this.gmailProjudiManifestacaoService = gmailProjudiManifestacaoService;
        this.emailImportacaoSyncService = emailImportacaoSyncService;
        this.jobRunTracker = jobRunTracker;
    }

    @GetMapping("/sync")
    @Operation(summary = "Data/hora da última busca Gmail (Projudi)")
    public ResponseEntity<EmailImportacaoSyncStatusResponse> syncStatus() {
        EmailImportacaoSyncStatusResponse r = new EmailImportacaoSyncStatusResponse();
        r.setTipo(EmailImportacaoSyncTipo.PROJUDI.getId());
        r.setUltimaSincronizacaoEm(
                emailImportacaoSyncService.obterUltimaSincronizacao(EmailImportacaoSyncTipo.PROJUDI).orElse(null));
        return ResponseEntity.ok(r);
    }

    @PostMapping("/processar")
    @Operation(summary = "Processar emails Projudi e importar manifestações")
    public ResponseEntity<?> processar(
            @RequestParam(name = "forcar", defaultValue = "false") boolean forcarAtualizacaoCompleta,
            @RequestParam(name = "desde", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
                    Instant desdeOverride) {
        if (gmailProjudiManifestacaoService == null || !gmailProjudiManifestacaoService.isDisponivel()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of(
                            "message",
                            "Gmail API não configurada. Verifique credentials.json e tokens OAuth em gmail.tokens.directory."));
        }
        try {
            String jobName =
                    forcarAtualizacaoCompleta ? JobNames.GMAIL_PROJUDI_COMPLETO : JobNames.GMAIL_PROJUDI;
            PublicacaoEmailProcessamentoResumo resumo = jobRunTracker.runTrackedJob(jobName, ctx -> {
                ctx.putMetadata("trigger", "manual");
                PublicacaoEmailProcessamentoResumo r;
                try {
                    r = gmailProjudiManifestacaoService.buscarEProcessarManifestacoesManual(
                            forcarAtualizacaoCompleta, desdeOverride);
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                }
                JobRunEmailResumoUtil.aplicarResumo(ctx, r);
                return r;
            });
            return ResponseEntity.ok(resumo);
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Falha ao processar emails Projudi: " + mensagemRaiz(ex)));
        }
    }

    private static String mensagemRaiz(Throwable ex) {
        Throwable t = ex;
        String last = t.getMessage() != null ? t.getMessage() : t.getClass().getSimpleName();
        while (t.getCause() != null && t.getCause() != t) {
            t = t.getCause();
            if (t.getMessage() != null && !t.getMessage().isBlank()) {
                last = t.getMessage();
            }
        }
        return last;
    }
}
