package br.com.vilareal.email;

import br.com.vilareal.email.dto.EmailImportacaoSyncStatusResponse;
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

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/email/trt")
@Tag(name = "Email — Movimentações PUSH TRT (PJe)")
public class TrtPushEmailController {

    private final GmailTrtPushManifestacaoService gmailTrtPushManifestacaoService;
    private final EmailImportacaoSyncService emailImportacaoSyncService;

    public TrtPushEmailController(
            GmailTrtPushManifestacaoService gmailTrtPushManifestacaoService,
            EmailImportacaoSyncService emailImportacaoSyncService) {
        this.gmailTrtPushManifestacaoService = gmailTrtPushManifestacaoService;
        this.emailImportacaoSyncService = emailImportacaoSyncService;
    }

    @GetMapping("/sync")
    @Operation(summary = "Data/hora da última busca Gmail (TRT PUSH)")
    public ResponseEntity<EmailImportacaoSyncStatusResponse> syncStatus() {
        EmailImportacaoSyncStatusResponse r = new EmailImportacaoSyncStatusResponse();
        r.setTipo(EmailImportacaoSyncTipo.TRT.getId());
        r.setUltimaSincronizacaoEm(
                emailImportacaoSyncService.obterUltimaSincronizacao(EmailImportacaoSyncTipo.TRT).orElse(null));
        return ResponseEntity.ok(r);
    }

    @PostMapping("/processar")
    @Operation(summary = "Processar emails PUSH do TRT e importar movimentações")
    public ResponseEntity<?> processar(
            @RequestParam(name = "forcar", defaultValue = "false") boolean forcarAtualizacaoCompleta,
            @RequestParam(name = "desde", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
                    Instant desdeOverride) {
        if (gmailTrtPushManifestacaoService == null || !gmailTrtPushManifestacaoService.isDisponivel()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of(
                            "message",
                            "Gmail API não configurada. Verifique credentials.json e tokens OAuth em gmail.tokens.directory."));
        }
        try {
            PublicacaoEmailProcessamentoResumo resumo =
                    gmailTrtPushManifestacaoService.buscarEProcessarManifestacoesManual(
                            forcarAtualizacaoCompleta, desdeOverride);
            return ResponseEntity.ok(resumo);
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Falha ao processar emails TRT: " + mensagemRaiz(ex)));
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
