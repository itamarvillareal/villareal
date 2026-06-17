package br.com.vilareal.email;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.UncheckedIOException;

/**
 * Gatilho manual (somente perfil {@code dev}) para testar importação de extrato Cora via Gmail.
 */
@RestController
@RequestMapping("/api/dev/extrato-cora")
@Profile("dev")
@Tag(name = "Dev — Extrato Cora", description = "Disparo manual da importação Cora por e-mail (apenas dev)")
public class ExtratoCoraDevController {

    private final GmailExtratoCoraService gmailExtratoCoraService;

    public ExtratoCoraDevController(GmailExtratoCoraService gmailExtratoCoraService) {
        this.gmailExtratoCoraService = gmailExtratoCoraService;
    }

    @PostMapping("/rodar-agora")
    @Operation(summary = "Executa uma rodada de importação de extrato Cora via Gmail")
    public ResponseEntity<ExtratoCoraEmailProcessamentoResumo> rodarAgora() {
        if (!gmailExtratoCoraService.isDisponivel()) {
            ExtratoCoraEmailProcessamentoResumo indisponivel = new ExtratoCoraEmailProcessamentoResumo();
            indisponivel.getErros().add("Gmail API não configurada.");
            return ResponseEntity.ok(indisponivel);
        }
        try {
            return ResponseEntity.ok(gmailExtratoCoraService.buscarEImportarExtratos());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
