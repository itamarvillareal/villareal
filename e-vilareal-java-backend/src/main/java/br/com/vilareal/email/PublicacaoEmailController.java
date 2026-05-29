package br.com.vilareal.email;

import br.com.vilareal.email.dto.EmailImportacaoSyncStatusResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/email/publicacoes")
@Tag(name = "Email — Publicações Jusbrasil")
public class PublicacaoEmailController {

    private final GmailPublicacaoService gmailPublicacaoService;
    private final EmailImportacaoSyncService emailImportacaoSyncService;

    public PublicacaoEmailController(
            GmailPublicacaoService gmailPublicacaoService,
            EmailImportacaoSyncService emailImportacaoSyncService) {
        this.gmailPublicacaoService = gmailPublicacaoService;
        this.emailImportacaoSyncService = emailImportacaoSyncService;
    }

    @GetMapping("/sync")
    @Operation(summary = "Data/hora da última busca Gmail (Jusbrasil)")
    public ResponseEntity<EmailImportacaoSyncStatusResponse> syncStatus() {
        EmailImportacaoSyncStatusResponse r = new EmailImportacaoSyncStatusResponse();
        r.setTipo(EmailImportacaoSyncTipo.JUSBRASIL.getId());
        r.setUltimaSincronizacaoEm(
                emailImportacaoSyncService.obterUltimaSincronizacao(EmailImportacaoSyncTipo.JUSBRASIL).orElse(null));
        return ResponseEntity.ok(r);
    }

    @PostMapping("/processar")
    @Operation(summary = "Processar emails Jusbrasil e importar publicações")
    public ResponseEntity<?> processar(
            @RequestParam(name = "forcar", defaultValue = "false") boolean forcarAtualizacaoCompleta) {
        if (gmailPublicacaoService == null || !gmailPublicacaoService.isDisponivel()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of(
                            "message",
                            "Gmail API não configurada. Verifique credentials.json e tokens OAuth em gmail.tokens.directory."));
        }
        try {
            PublicacaoEmailProcessamentoResumo resumo =
                    gmailPublicacaoService.buscarEProcessarPublicacoesManual(forcarAtualizacaoCompleta);
            return ResponseEntity.ok(resumo);
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Falha ao processar emails: " + mensagemRaiz(ex)));
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
