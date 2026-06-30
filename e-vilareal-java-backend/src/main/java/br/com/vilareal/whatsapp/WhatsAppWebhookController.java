package br.com.vilareal.whatsapp;

import br.com.vilareal.config.WhatsAppConfig;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.Change;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.Entry;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.IncomingMessage;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.MessageStatus;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.Value;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.WebhookContact;
import br.com.vilareal.whatsapp.service.WhatsAppMediaService;
import br.com.vilareal.whatsapp.service.WhatsAppService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Webhook da Meta para verificação e recebimento de mensagens/status WhatsApp.
 */
@RestController
@RequestMapping("/api/webhook/whatsapp")
public class WhatsAppWebhookController {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppWebhookController.class);

    private final WhatsAppConfig whatsAppConfig;
    private final WhatsAppService whatsAppService;
    private final ObjectMapper objectMapper;

    public WhatsAppWebhookController(
            WhatsAppConfig whatsAppConfig, WhatsAppService whatsAppService, ObjectMapper objectMapper) {
        this.whatsAppConfig = whatsAppConfig;
        this.whatsAppService = whatsAppService;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    public ResponseEntity<String> verifyWebhook(
            @RequestParam("hub.mode") String mode,
            @RequestParam("hub.verify_token") String token,
            @RequestParam("hub.challenge") String challenge) {
        log.info("Webhook verification request recebido. Mode: {}", mode);

        if ("subscribe".equals(mode) && whatsAppConfig.getVerifyToken().equals(token)) {
            log.info("Webhook verificado com sucesso");
            return ResponseEntity.ok().contentType(MediaType.TEXT_PLAIN).body(challenge);
        }

        log.warn("Webhook verification falhou. Token inválido.");
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Verification failed");
    }

    @PostMapping
    public ResponseEntity<Void> receiveWebhook(
            @RequestBody String rawBody,
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature) {
        if (whatsAppConfig.isValidateSignature()) {
            if (!StringUtils.hasText(signature)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }
            if (!validateSignature(rawBody, signature)) {
                log.warn("Assinatura inválida");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }
        }

        CompletableFuture.runAsync(() -> {
            try {
                WhatsAppWebhookPayload payload = objectMapper.readValue(rawBody, WhatsAppWebhookPayload.class);
                processWebhook(payload);
            } catch (Exception e) {
                log.error("Falha ao processar webhook WhatsApp: {}", e.getMessage());
            }
        });

        return ResponseEntity.ok().build();
    }

    private void processWebhook(WhatsAppWebhookPayload payload) {
        if (payload == null || payload.entry() == null) {
            return;
        }

        for (Entry entry : payload.entry()) {
            if (entry == null || entry.changes() == null) {
                continue;
            }

            for (Change change : entry.changes()) {
                if (change == null || change.value() == null) {
                    continue;
                }

                Value value = change.value();
                processIncomingMessages(value);
                processStatusUpdates(value);
            }
        }
    }

    private void processIncomingMessages(Value value) {
        List<IncomingMessage> messages = value.messages();
        if (messages == null || messages.isEmpty()) {
            return;
        }

        String contactName = extractContactName(value.contacts());

        for (IncomingMessage message : messages) {
            if (message == null) {
                continue;
            }

            String from = message.from();
            String type = message.type();
            String msgId = message.id();

            String body = message.text() != null ? message.text().body() : null;
            String mediaId = null;
            String mimeType = null;
            String filename = null;

            switch (type != null ? type.toLowerCase() : "") {
                case "image" -> {
                    if (message.image() != null) {
                        mediaId = message.image().mediaId();
                        mimeType = message.image().mimeType();
                        filename = "imagem." + WhatsAppMediaService.extensaoFromMime(mimeType);
                        if (body == null && StringUtils.hasText(message.image().caption())) {
                            body = message.image().caption();
                        }
                    }
                }
                case "document" -> {
                    if (message.document() != null) {
                        mediaId = message.document().mediaId();
                        mimeType = message.document().mimeType();
                        filename = message.document().filename();
                        if (body == null && StringUtils.hasText(message.document().caption())) {
                            body = message.document().caption();
                        }
                    }
                }
                case "audio" -> {
                    if (message.audio() != null) {
                        mediaId = message.audio().mediaId();
                        mimeType = message.audio().mimeType();
                        filename = "audio." + WhatsAppMediaService.extensaoFromMime(mimeType);
                    }
                }
                case "video" -> {
                    if (message.video() != null) {
                        mediaId = message.video().mediaId();
                        mimeType = message.video().mimeType();
                        filename = "video." + WhatsAppMediaService.extensaoFromMime(mimeType);
                        if (body == null && StringUtils.hasText(message.video().caption())) {
                            body = message.video().caption();
                        }
                    }
                }
                default -> { }
            }

            log.info(
                    "Mensagem recebida de {} ({}): tipo={}",
                    maskPhoneNumber(from),
                    contactName != null ? contactName : "desconhecido",
                    type);
            log.debug("Conteúdo: {} (id={}, mediaId={})", body, msgId, mediaId);

            whatsAppService.processInboundMessage(
                    from, body, type, msgId, contactName, mediaId, mimeType, filename);
        }
    }

    private void processStatusUpdates(Value value) {
        List<MessageStatus> statuses = value.statuses();
        if (statuses == null || statuses.isEmpty()) {
            return;
        }

        for (MessageStatus status : statuses) {
            if (status == null) {
                continue;
            }

            log.info("Status update: mensagem {} → {}", status.id(), status.status());

            whatsAppService.updateMessageStatus(status.id(), status.status());
        }
    }

    private static String extractContactName(List<WebhookContact> contacts) {
        if (contacts == null || contacts.isEmpty()) {
            return null;
        }
        WebhookContact contact = contacts.getFirst();
        if (contact == null || contact.profile() == null) {
            return null;
        }
        return contact.profile().name();
    }

    private boolean validateSignature(String payload, String signatureHeader) {
        String expectedHash = signatureHeader.replace("sha256=", "").trim();
        String calculatedHash = calculateHmacSha256(payload, whatsAppConfig.getAppSecret());

        boolean valid = MessageDigest.isEqual(
                calculatedHash.getBytes(StandardCharsets.UTF_8), expectedHash.getBytes(StandardCharsets.UTF_8));

        if (!valid) {
            log.warn(
                    "Assinatura HMAC divergente. Calculado (8): {}..., Recebido (8): {}...",
                    prefix(calculatedHash, 8),
                    prefix(expectedHash, 8));
        }

        return valid;
    }

    private static String calculateHmacSha256(String payload, String appSecret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey =
                    new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKey);
            byte[] hmacBytes = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return bytesToHex(hmacBytes);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao calcular HMAC-SHA256 do webhook WhatsApp", e);
        }
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private static String maskPhoneNumber(String phone) {
        if (!StringUtils.hasText(phone) || phone.length() < 8) {
            return "****";
        }
        return phone.substring(0, 5) + "****" + phone.substring(phone.length() - 4);
    }

    private static String prefix(String value, int length) {
        if (value == null) {
            return "";
        }
        return value.length() <= length ? value : value.substring(0, length);
    }
}
