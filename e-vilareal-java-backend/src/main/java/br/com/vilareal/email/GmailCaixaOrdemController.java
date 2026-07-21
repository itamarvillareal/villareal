package br.com.vilareal.email;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/email/caixa-ordem")
public class GmailCaixaOrdemController {

    private final GmailCaixaOrdemService gmailCaixaOrdemService;

    public GmailCaixaOrdemController(GmailCaixaOrdemService gmailCaixaOrdemService) {
        this.gmailCaixaOrdemService = gmailCaixaOrdemService;
    }

    /** Rele a ordem da caixa Gmail e atualiza {@code gmail_caixa_ordem} das publicações PROJUDI/TRT. */
    @PostMapping("/atualizar")
    public Map<String, Integer> atualizar() throws IOException {
        int n = gmailCaixaOrdemService.atualizarOrdemCaixaInbox();
        return Map.of("publicacoesAtualizadas", n);
    }
}
