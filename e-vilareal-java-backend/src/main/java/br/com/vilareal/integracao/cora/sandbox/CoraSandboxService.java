package br.com.vilareal.integracao.cora.sandbox;

import br.com.vilareal.integracao.cora.CoraHttpResponse;
import br.com.vilareal.integracao.cora.CoraTokenService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/**
 * Facade do laboratório Cora — métodos de alto nível para smoke tests manuais.
 */
public class CoraSandboxService {

    private static final Logger log = LoggerFactory.getLogger(CoraSandboxService.class);

    private final CoraTokenService tokenService;
    private final CoraSandboxApiClient apiClient;
    private final ObjectMapper objectMapper;

    public CoraSandboxService(
            CoraTokenService tokenService, CoraSandboxApiClient apiClient, ObjectMapper objectMapper) {
        this.tokenService = tokenService;
        this.apiClient = apiClient;
        this.objectMapper = objectMapper;
    }

    /** Smoke: mTLS + token + extrato dos últimos 7 dias. */
    public Map<String, Object> runSmoke() {
        boolean mtlsOk = tokenService.verifyMtlsAndAuth();
        String tokenPreview = mtlsOk ? CoraTokenService.maskToken(tokenService.getToken()) : null;

        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(7);
        CoraHttpResponse extrato = mtlsOk ? apiClient.consultarExtrato(start, end) : null;

        if (extrato != null) {
            apiClient.logExtratoItens(extrato);
        }

        return Map.of(
                "mtlsOk", mtlsOk,
                "tokenPreview", tokenPreview != null ? tokenPreview : "",
                "extratoStatus", extrato != null ? extrato.statusCode() : -1,
                "extratoOk", extrato != null && extrato.isSuccess(),
                "extratoBodyPreview",
                        extrato != null ? preview(extrato.body(), 500) : "",
                "message",
                        mtlsOk
                                ? "Conexão mTLS + token OK. Verifique logs do extrato."
                                : "Falha mTLS/autenticação — veja logs.");
    }

    public CoraHttpResponse emitirBoleto() throws Exception {
        String idempotencyKey = UUID.randomUUID().toString();
        String code = "vr-sandbox-" + System.currentTimeMillis();
        String json = apiClient.buildBoletoTesteJson(code);
        CoraHttpResponse response = apiClient.emitirBoleto(idempotencyKey, json);
        apiClient.logBoletoResposta(response);
        return response;
    }

    public CoraHttpResponse consultarBoleto(String invoiceId) {
        CoraHttpResponse response = apiClient.consultarBoleto(invoiceId);
        log.info("[CoraSandbox] Consulta boleto {} → HTTP {}", invoiceId, response.statusCode());
        log.info("[CoraSandbox] Corpo: {}", response.body());
        return response;
    }

    public CoraHttpResponse consultarExtrato(LocalDate start, LocalDate end) {
        CoraHttpResponse response = apiClient.consultarExtrato(start, end);
        apiClient.logExtratoItens(response);
        return response;
    }

    /**
     * Inicia pagamento por linha digitável e consulta estado em seguida.
     *
     * <p><b>Onde observar "aguardando aprovação":</b> na resposta imediata de POST /payments/initiate
     * o campo {@code status} vem como {@code INITIATED} (doc Cora: aguardando aprovação no app).
     * A consulta em GET /payments confirma se permanece {@code INITIATED} ou mudou após aprovação
     * no aplicativo Cora. Liquidação no extrato ({@link #consultarExtrato}) é outro sinal tardio.
     */
    public Map<String, Object> iniciarPagamento(String linhaDigitavel, LocalDate scheduledAt) throws Exception {
        String idempotencyKey = UUID.randomUUID().toString();
        String json = apiClient.buildIniciarPagamentoJson(linhaDigitavel, scheduledAt);

        CoraHttpResponse initiate = apiClient.iniciarPagamento(idempotencyKey, json);
        log.info("[CoraSandbox] === INICIAÇÃO DE PAGAMENTO ===");
        log.info("[CoraSandbox] HTTP status: {}", initiate.statusCode());
        log.info("[CoraSandbox] Corpo completo: {}", initiate.body());

        String paymentId = null;
        String statusIniciacao = null;
        if (initiate.isSuccess()) {
            JsonNode root = objectMapper.readTree(initiate.body());
            paymentId = root.path("id").asText(null);
            statusIniciacao = root.path("status").asText(null);
            log.info(
                    "[CoraSandbox] Pagamento iniciado id={} status={} ← INITIATED = aguardando aprovação no app Cora",
                    paymentId,
                    statusIniciacao);
        }

        CoraHttpResponse listagem = null;
        String statusConsulta = null;
        if (paymentId != null) {
            LocalDate end = LocalDate.now();
            LocalDate start = end.minusDays(30);
            listagem = apiClient.listarPagamentos("INITIATED", start, end);
            log.info("[CoraSandbox] === CONSULTA GET /payments (status=INITIATED) ===");
            log.info("[CoraSandbox] HTTP status: {}", listagem.statusCode());
            log.info("[CoraSandbox] Corpo: {}", listagem.body());
            statusConsulta = findPaymentStatus(listagem.body(), paymentId);
            if (statusConsulta != null) {
                log.info(
                        "[CoraSandbox] Estado observado na listagem para {}: {} "
                                + "(INITIATED = ainda aguardando aprovação; outros = ver doc Cora)",
                        paymentId,
                        statusConsulta);
            }
        }

        LocalDate end = LocalDate.now();
        CoraHttpResponse extrato = apiClient.consultarExtrato(end.minusDays(7), end);
        log.info("[CoraSandbox] === EXTRATO (últimos 7 dias) após iniciação ===");
        log.info("[CoraSandbox] HTTP status: {}", extrato.statusCode());
        apiClient.logExtratoItens(extrato);

        boolean aguardandoAprovacao =
                "INITIATED".equalsIgnoreCase(statusIniciacao) || "INITIATED".equalsIgnoreCase(statusConsulta);

        return Map.of(
                "initiateStatus", initiate.statusCode(),
                "initiateBody", initiate.body(),
                "paymentId", paymentId != null ? paymentId : "",
                "statusIniciacao", statusIniciacao != null ? statusIniciacao : "",
                "statusConsulta", statusConsulta != null ? statusConsulta : "",
                "aguardandoAprovacaoApp", aguardandoAprovacao,
                "interpretacao",
                        aguardandoAprovacao
                                ? "Pagamento INITIATED — aguardando aprovação no aplicativo Cora (não liquidado ainda)."
                                : "Verifique status no corpo/logs; pode ter sido aprovado ou rejeitado.",
                "listagemBody", listagem != null ? preview(listagem.body(), 1000) : "",
                "extratoStatus", extrato.statusCode());
    }

    private String findPaymentStatus(String listagemBody, String paymentId) {
        try {
            JsonNode root = objectMapper.readTree(listagemBody);
            JsonNode content = root.path("content");
            if (!content.isArray()) {
                return null;
            }
            for (JsonNode item : content) {
                if (paymentId.equals(item.path("id").asText())) {
                    return item.path("status").asText(null);
                }
            }
        } catch (Exception e) {
            log.warn("[CoraSandbox] Erro ao parsear listagem de pagamentos: {}", e.getMessage());
        }
        return null;
    }

    private static String preview(String body, int max) {
        if (body == null) {
            return "";
        }
        return body.length() <= max ? body : body.substring(0, max) + "...";
    }
}
