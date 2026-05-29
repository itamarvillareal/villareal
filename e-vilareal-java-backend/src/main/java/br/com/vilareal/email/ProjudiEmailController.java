package br.com.vilareal.email;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/email/projudi")
@Tag(name = "Email — Manifestações Projudi TJGO")
public class ProjudiEmailController {

    private final GmailProjudiManifestacaoService gmailProjudiManifestacaoService;

    public ProjudiEmailController(GmailProjudiManifestacaoService gmailProjudiManifestacaoService) {
        this.gmailProjudiManifestacaoService = gmailProjudiManifestacaoService;
    }

    @PostMapping("/processar")
    @Operation(summary = "Processar emails Projudi (últimos 7 dias) e importar manifestações")
    public ResponseEntity<?> processar() {
        if (gmailProjudiManifestacaoService == null || !gmailProjudiManifestacaoService.isDisponivel()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of(
                            "message",
                            "Gmail API não configurada. Verifique credentials.json e tokens OAuth em gmail.tokens.directory."));
        }
        try {
            PublicacaoEmailProcessamentoResumo resumo =
                    gmailProjudiManifestacaoService.buscarEProcessarManifestacoesManual();
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
