package br.com.vilareal.email;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/email/extrato-cora")
@Tag(name = "Email — Extrato Cora", description = "Importação de extrato Cora via Gmail (OFX em anexo)")
public class ExtratoCoraEmailController {

    private final GmailExtratoCoraService gmailExtratoCoraService;

    public ExtratoCoraEmailController(GmailExtratoCoraService gmailExtratoCoraService) {
        this.gmailExtratoCoraService = gmailExtratoCoraService;
    }

    @PostMapping("/processar")
    @Operation(summary = "Buscar e-mails Cora no Gmail e importar extrato OFX")
    public ResponseEntity<?> processar(
            @RequestParam(name = "incluirLidos", defaultValue = "false") boolean incluirLidos) {
        if (!gmailExtratoCoraService.isDisponivel()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of(
                            "message",
                            "Gmail API não configurada. Verifique credentials.json e tokens OAuth em gmail.tokens.directory."));
        }
        try {
            ExtratoCoraEmailProcessamentoResumo resumo =
                    gmailExtratoCoraService.buscarEImportarExtratos(incluirLidos);
            return ResponseEntity.ok(resumo);
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Falha ao importar extrato Cora: " + mensagemRaiz(ex)));
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
