package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppConfig;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteWhatsAppRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.whatsapp.WhatsAppApiException;
import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.WhatsAppMessageStatus;
import br.com.vilareal.whatsapp.WhatsAppMessageType;
import br.com.vilareal.whatsapp.dto.WhatsAppErrorResponse;
import br.com.vilareal.whatsapp.dto.WhatsAppSendResponse;
import br.com.vilareal.whatsapp.dto.WhatsAppTemplateMessageRequest;
import br.com.vilareal.whatsapp.dto.WhatsAppTemplateMessageRequest.Component;
import br.com.vilareal.whatsapp.dto.WhatsAppTemplateMessageRequest.Language;
import br.com.vilareal.whatsapp.dto.WhatsAppTemplateMessageRequest.Parameter;
import br.com.vilareal.whatsapp.dto.WhatsAppTemplateMessageRequest.Template;
import br.com.vilareal.whatsapp.dto.WhatsAppTextMessageRequest;
import br.com.vilareal.whatsapp.dto.WhatsAppTextMessageRequest.TextBody;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Envio de mensagens via WhatsApp Business Cloud API (Meta Graph).
 */
@Service
public class WhatsAppService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppService.class);

    private final WhatsAppConfig whatsAppConfig;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final WhatsAppMessageRepository whatsAppMessageRepository;
    private final PessoaContatoRepository pessoaContatoRepository;
    private final ClienteRepository clienteRepository;
    private final ClienteWhatsAppRepository clienteWhatsAppRepository;
    private final WhatsAppAIService whatsAppAIService;

    public WhatsAppService(
            WhatsAppConfig whatsAppConfig,
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            WhatsAppMessageRepository whatsAppMessageRepository,
            PessoaContatoRepository pessoaContatoRepository,
            ClienteRepository clienteRepository,
            ClienteWhatsAppRepository clienteWhatsAppRepository,
            @Lazy WhatsAppAIService whatsAppAIService) {
        this.whatsAppConfig = whatsAppConfig;
        this.objectMapper = objectMapper;
        this.whatsAppMessageRepository = whatsAppMessageRepository;
        this.pessoaContatoRepository = pessoaContatoRepository;
        this.clienteRepository = clienteRepository;
        this.clienteWhatsAppRepository = clienteWhatsAppRepository;
        this.whatsAppAIService = whatsAppAIService;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        requestFactory.setReadTimeout(Duration.ofSeconds(30));

        this.restClient = restClientBuilder
                .baseUrl(whatsAppConfig.getApiUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + whatsAppConfig.getAccessToken())
                .requestFactory(requestFactory)
                .build();
    }

    public WhatsAppSendResponse sendTextMessage(String phoneNumber, String message) {
        String formattedPhone = formatPhoneNumber(phoneNumber);
        log.info("Enviando mensagem de texto para {}", maskPhoneNumber(formattedPhone));
        log.debug("Destinatário completo (texto): {}", formattedPhone);

        WhatsAppTextMessageRequest request = new WhatsAppTextMessageRequest(
                "whatsapp",
                "individual",
                formattedPhone,
                "text",
                new TextBody(false, message));

        WhatsAppSendResponse response =
                executeSend(request, formattedPhone, "mensagem de texto", SendContext.texto(message));
        persistOutboundMessage(response, formattedPhone, WhatsAppMessageType.TEXT, message, null);
        return response;
    }

    public WhatsAppSendResponse sendTemplateMessage(
            String phoneNumber, String templateName, String languageCode, List<String> parameters) {
        String formattedPhone = formatPhoneNumber(phoneNumber);
        log.info("Enviando mensagem de template para {}", maskPhoneNumber(formattedPhone));
        log.debug("Destinatário completo (template {}): {}", templateName, formattedPhone);

        List<Component> components = null;
        if (parameters != null && !parameters.isEmpty()) {
            List<Parameter> templateParameters =
                    parameters.stream().map(value -> new Parameter("text", value)).toList();
            components = List.of(new Component("body", templateParameters));
        }

        WhatsAppTemplateMessageRequest request = new WhatsAppTemplateMessageRequest(
                "whatsapp",
                formattedPhone,
                "template",
                new Template(templateName, new Language(languageCode), components));

        WhatsAppSendResponse response = executeSend(
                request,
                formattedPhone,
                "mensagem de template",
                SendContext.template(templateName, parameters));
        String content =
                parameters != null && !parameters.isEmpty() ? String.join(", ", parameters) : null;
        persistOutboundMessage(response, formattedPhone, WhatsAppMessageType.TEMPLATE, content, templateName);
        return response;
    }

    public WhatsAppSendResponse sendLembreteAudiencia(
            String phoneNumber, String nomeCliente, String numeroProcesso, String dataHora) {
        return sendTemplateMessage(
                phoneNumber,
                "lembrete_audiencia",
                "pt_BR",
                List.of(nomeCliente, numeroProcesso, dataHora));
    }

    public WhatsAppSendResponse sendAtualizacaoProcesso(
            String phoneNumber, String nomeCliente, String numeroProcesso, String movimentacao) {
        return sendTemplateMessage(
                phoneNumber,
                "atualizacao_processo",
                "pt_BR",
                List.of(nomeCliente, numeroProcesso, movimentacao));
    }

    public WhatsAppSendResponse sendBoasVindas(String phoneNumber, String nomeCliente) {
        return sendTemplateMessage(phoneNumber, "boas_vindas_cliente", "pt_BR", List.of(nomeCliente));
    }

    @Transactional
    public void processInboundMessage(
            String from, String body, String type, String waMessageId, String contactName) {
        if (!StringUtils.hasText(waMessageId)) {
            log.warn("Mensagem inbound ignorada: waMessageId ausente");
            return;
        }

        if (whatsAppMessageRepository.findByWaMessageId(waMessageId).isPresent()) {
            log.debug("Mensagem inbound duplicada ignorada: {}", waMessageId);
            return;
        }

        WhatsAppMessageEntity msg = new WhatsAppMessageEntity();
        msg.setWaMessageId(waMessageId);
        msg.setPhoneNumber(from);
        msg.setContactName(contactName);
        msg.setDirection(WhatsAppMessageDirection.INBOUND);
        msg.setMessageType(parseMessageType(type));
        msg.setContent(body);
        msg.setStatus(WhatsAppMessageStatus.RECEIVED);

        Long clienteId = resolveClienteId(from);
        msg.setClienteId(clienteId);

        try {
            WhatsAppMessageEntity saved = whatsAppMessageRepository.save(msg);
            log.info(
                    "Mensagem inbound salva. ID: {}, Cliente: {}",
                    saved.getId(),
                    clienteId != null ? clienteId : "não identificado");
        } catch (Exception e) {
            log.error("Falha ao salvar mensagem inbound no banco: {}", e.getMessage());
            return;
        }

        if ("text".equalsIgnoreCase(type) && body != null && !body.isBlank()) {
            try {
                whatsAppAIService.handleIncomingMessage(from, body, contactName);
            } catch (Exception e) {
                log.error("Falha ao processar mensagem inbound com IA: {}", e.getMessage(), e);
            }
        }
    }

    @Transactional
    public void updateMessageStatus(String waMessageId, String newStatus) {
        if (!StringUtils.hasText(waMessageId) || !StringUtils.hasText(newStatus)) {
            return;
        }

        Optional<WhatsAppMessageEntity> optionalMessage = whatsAppMessageRepository.findByWaMessageId(waMessageId);
        if (optionalMessage.isEmpty()) {
            log.debug("Status update para mensagem desconhecida: {}", waMessageId);
            return;
        }

        WhatsAppMessageStatus parsedStatus = parseWebhookStatus(newStatus);
        if (parsedStatus == null) {
            log.warn("Status WhatsApp desconhecido: {} (mensagem {})", newStatus, waMessageId);
            return;
        }

        WhatsAppMessageEntity msg = optionalMessage.get();
        msg.setStatus(parsedStatus);
        if (parsedStatus == WhatsAppMessageStatus.FAILED) {
            msg.setErrorMessage("Status failed reportado pelo webhook Meta");
        }

        try {
            whatsAppMessageRepository.save(msg);
            log.info("Status atualizado: {} → {}", waMessageId, newStatus);
        } catch (Exception e) {
            log.error("Falha ao atualizar status da mensagem {}: {}", waMessageId, e.getMessage());
        }
    }

    private record SendContext(boolean isCopia, String tipo, String resumo) {
        static SendContext texto(String corpo) {
            return new SendContext(false, "texto", corpo != null ? corpo : "");
        }

        static SendContext template(String templateName, List<String> parameters) {
            return new SendContext(false, "template", resumoTemplate(templateName, parameters));
        }

        static SendContext copiaMonitoramento() {
            return new SendContext(true, "texto", "");
        }
    }

    private WhatsAppSendResponse executeSend(
            Object requestBody, String formattedPhone, String messageKind, SendContext context) {
        try {
            WhatsAppSendResponse response = restClient
                    .post()
                    .uri("/{phoneNumberId}/messages", whatsAppConfig.getPhoneNumberId())
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(WhatsAppSendResponse.class);

            if (response == null) {
                throw new WhatsAppApiException("Resposta vazia da WhatsApp API.", 0, null, 0);
            }

            String waMessageId = extractMessageId(response);
            log.info("Mensagem enviada com sucesso. ID: {}", waMessageId);
            log.debug("{} entregue para {}", messageKind, formattedPhone);
            if (!context.isCopia()) {
                agendarCopiaMonitoramento(formattedPhone, context);
            }
            return response;
        } catch (RestClientResponseException e) {
            throw traduzirErroHttp(e);
        } catch (WhatsAppApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Falha de conexão com WhatsApp API: {}", e.getMessage());
            throw new WhatsAppApiException(
                    "Falha de conexão com WhatsApp API: " + e.getMessage(), 0, null, 0, e);
        }
    }

    private void agendarCopiaMonitoramento(String telefoneDestino, SendContext context) {
        WhatsAppConfig.CopiaMonitoramento cfg = whatsAppConfig.getCopiaMonitoramento();
        if (cfg == null || !cfg.isAtivo() || !StringUtils.hasText(cfg.getNumero())) {
            return;
        }
        try {
            String monitorPhone = formatPhoneNumber(cfg.getNumero());
            if (telefoneDestino.equals(monitorPhone)) {
                return;
            }
            String corpoCopia = montarTextoCopiaMonitoramento(context.tipo(), telefoneDestino, context.resumo());
            Thread.startVirtualThread(() -> enviarCopiaMonitoramento(monitorPhone, corpoCopia));
        } catch (Exception e) {
            log.warn("Não foi possível agendar cópia de monitoramento WhatsApp: {}", e.getMessage());
        }
    }

    private void enviarCopiaMonitoramento(String monitorPhone, String corpoCopia) {
        try {
            WhatsAppTextMessageRequest request = new WhatsAppTextMessageRequest(
                    "whatsapp",
                    "individual",
                    monitorPhone,
                    "text",
                    new TextBody(false, corpoCopia));
            WhatsAppSendResponse response =
                    executeSend(request, monitorPhone, "cópia monitoramento", SendContext.copiaMonitoramento());
            persistOutboundMessage(response, monitorPhone, WhatsAppMessageType.TEXT, corpoCopia, null);
        } catch (Exception e) {
            log.warn("Falha ao enviar cópia de monitoramento WhatsApp: {}", e.getMessage());
        }
    }

    static String montarTextoCopiaMonitoramento(String tipo, String telefoneDestino, String resumo) {
        return "[cópia] %s para %s: %s".formatted(tipo, telefoneDestino, resumo != null ? resumo : "");
    }

    static String resumoTemplate(String templateName, List<String> parameters) {
        if (!StringUtils.hasText(templateName)) {
            return "";
        }
        if (parameters == null || parameters.isEmpty()) {
            return templateName;
        }
        return templateName + " (" + String.join(", ", parameters) + ")";
    }

    private void persistOutboundMessage(
            WhatsAppSendResponse response,
            String formattedPhone,
            WhatsAppMessageType messageType,
            String content,
            String templateName) {
        String waMessageId = extractMessageId(response);
        if (!StringUtils.hasText(waMessageId) || "desconhecido".equals(waMessageId)) {
            return;
        }

        WhatsAppMessageEntity msg = new WhatsAppMessageEntity();
        msg.setWaMessageId(waMessageId);
        msg.setPhoneNumber(formattedPhone);
        msg.setDirection(WhatsAppMessageDirection.OUTBOUND);
        msg.setMessageType(messageType);
        msg.setContent(content);
        msg.setTemplateName(templateName);
        msg.setStatus(WhatsAppMessageStatus.SENT);

        try {
            whatsAppMessageRepository.save(msg);
        } catch (Exception e) {
            log.error("Falha ao salvar mensagem enviada no banco: {}", e.getMessage());
        }
    }

    /**
     * Vincula telefone inbound a {@code cliente.id}: primeiro {@code cliente_whatsapp}, depois
     * {@code pessoa_contato} (tipo telefone).
     */
    private Long resolveClienteId(String phoneFrom) {
        if (!StringUtils.hasText(phoneFrom)) {
            return null;
        }

        String digits = phoneFrom.replaceAll("\\D", "");
        if (digits.isEmpty()) {
            return null;
        }

        Optional<Long> viaClienteWhatsapp = clienteWhatsAppRepository.findClienteIdByTelefoneNormalizado(digits);
        if (viaClienteWhatsapp.isPresent()) {
            return viaClienteWhatsapp.get();
        }

        return pessoaContatoRepository
                .findPessoaIdByTelefoneNormalizado(digits)
                .flatMap(pessoaId -> clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(pessoaId).stream()
                        .findFirst()
                        .map(cliente -> cliente.getId()))
                .orElse(null);
    }

    private static WhatsAppMessageType parseMessageType(String type) {
        if (!StringUtils.hasText(type)) {
            return WhatsAppMessageType.UNKNOWN;
        }
        return switch (type.toLowerCase(Locale.ROOT)) {
            case "text" -> WhatsAppMessageType.TEXT;
            case "image" -> WhatsAppMessageType.IMAGE;
            case "document" -> WhatsAppMessageType.DOCUMENT;
            case "audio" -> WhatsAppMessageType.AUDIO;
            case "video" -> WhatsAppMessageType.VIDEO;
            case "interactive" -> WhatsAppMessageType.INTERACTIVE;
            case "button" -> WhatsAppMessageType.BUTTON;
            default -> WhatsAppMessageType.UNKNOWN;
        };
    }

    private static WhatsAppMessageStatus parseWebhookStatus(String newStatus) {
        try {
            return WhatsAppMessageStatus.valueOf(newStatus.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private WhatsAppApiException traduzirErroHttp(RestClientResponseException e) {
        int status = e.getStatusCode().value();
        String errorType = null;
        int metaErrorCode = 0;
        String message = "Erro ao enviar mensagem WhatsApp.";

        try {
            WhatsAppErrorResponse errorResponse =
                    objectMapper.readValue(e.getResponseBodyAsString(), WhatsAppErrorResponse.class);
            if (errorResponse.error() != null) {
                WhatsAppErrorResponse.ErrorDetail detail = errorResponse.error();
                errorType = detail.type();
                metaErrorCode = detail.code() != null ? detail.code() : 0;
                message = detail.message() != null ? detail.message() : message;
            }
        } catch (Exception parseError) {
            log.debug("Não foi possível deserializar erro da WhatsApp API: {}", parseError.getMessage());
            if (e.getResponseBodyAsString() != null && !e.getResponseBodyAsString().isBlank()) {
                message = e.getResponseBodyAsString();
            }
        }

        log.error("Erro ao enviar mensagem WhatsApp. HTTP {}, Meta error: {} - {}", status, metaErrorCode, message);
        return new WhatsAppApiException(message, status, errorType, metaErrorCode, e);
    }

    private static String extractMessageId(WhatsAppSendResponse response) {
        if (response.messages() == null || response.messages().isEmpty()) {
            return "desconhecido";
        }
        WhatsAppSendResponse.Message message = response.messages().getFirst();
        return message.id() != null ? message.id() : "desconhecido";
    }

    public static String formatPhoneNumber(String phone) {
        if (phone == null || phone.isBlank()) {
            throw new IllegalArgumentException("Número de telefone inválido: " + phone);
        }

        String digits = phone.replaceAll("\\D", "");
        if (digits.startsWith("0")) {
            digits = "55" + digits.substring(1);
        }
        if (!digits.startsWith("55")) {
            digits = "55" + digits;
        }

        int length = digits.length();
        if (length != 12 && length != 13) {
            throw new IllegalArgumentException("Número de telefone inválido: " + phone);
        }

        return digits;
    }

    private static String maskPhoneNumber(String digits) {
        if (digits == null || digits.length() < 8) {
            return "****";
        }
        return digits.substring(0, 5) + "****" + digits.substring(digits.length() - 4);
    }
}
