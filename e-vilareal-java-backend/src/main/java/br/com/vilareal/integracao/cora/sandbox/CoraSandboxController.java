package br.com.vilareal.integracao.cora.sandbox;

import br.com.vilareal.integracao.cora.CoraHttpResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/**
 * Endpoints do laboratório Cora (dev/stage). Não integra com financeiro/pagamentos.
 */
@RestController
@RequestMapping("/api/cora-sandbox")
@Profile("cora-sandbox")
@ConditionalOnProperty(name = "cora.sandbox.enabled", havingValue = "true")
@Tag(name = "Cora Sandbox", description = "Laboratório isolado — Integração Direta Cora (stage)")
public class CoraSandboxController {

    private static final Logger log = LoggerFactory.getLogger(CoraSandboxController.class);

    private final CoraSandboxService coraSandboxService;

    public CoraSandboxController(CoraSandboxService coraSandboxService) {
        this.coraSandboxService = coraSandboxService;
    }

    @GetMapping("/run-smoke")
    @Operation(summary = "Smoke: mTLS + token + extrato (7 dias)")
    public Map<String, Object> runSmoke() {
        return coraSandboxService.runSmoke();
    }

    @PostMapping("/test/emitir-boleto")
    @Operation(summary = "Emite boleto mínimo de teste (POST /v2/invoices)")
    public ResponseEntity<CoraHttpResponse> emitirBoleto() throws Exception {
        CoraHttpResponse response = coraSandboxService.emitirBoleto();
        return ResponseEntity.status(response.statusCode()).body(response);
    }

    @GetMapping("/test/consultar-boleto/{invoiceId}")
    public CoraHttpResponse consultarBoleto(@PathVariable String invoiceId) {
        return coraSandboxService.consultarBoleto(invoiceId);
    }

    @GetMapping("/test/consultar-extrato")
    public CoraHttpResponse consultarExtrato(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
        return coraSandboxService.consultarExtrato(start, end);
    }

    @PostMapping("/test/iniciar-pagamento")
    @Operation(summary = "Inicia pagamento (POST /payments/initiate) e consulta estado")
    public Map<String, Object> iniciarPagamento(
            @RequestParam String linhaDigitavel,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate scheduledAt)
            throws Exception {
        return coraSandboxService.iniciarPagamento(linhaDigitavel, scheduledAt);
    }

    @PostMapping("/webhook")
    @Operation(summary = "Receiver de webhook Cora — apenas loga payload")
    public ResponseEntity<Void> webhook(@RequestBody String rawBody, @RequestHeader Map<String, String> headers) {
        log.info("[CoraSandbox][Webhook] Headers: {}", headers);
        log.info("[CoraSandbox][Webhook] Payload bruto: {}", rawBody);
        return ResponseEntity.ok().build();
    }
}
