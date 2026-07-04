package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppConfig;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteWhatsAppRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.whatsapp.WhatsAppApiException;
import br.com.vilareal.whatsapp.WhatsAppMediaStatus;
import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.WhatsAppMessageStatus;
import br.com.vilareal.whatsapp.WhatsAppMessageType;
import br.com.vilareal.whatsapp.WhatsAppMediaCategory;
import br.com.vilareal.whatsapp.dto.WhatsAppErrorResponse;
import br.com.vilareal.whatsapp.dto.WhatsAppMediaMessageRequests.AudioBody;
import br.com.vilareal.whatsapp.dto.WhatsAppMediaMessageRequests.AudioMessageRequest;
import br.com.vilareal.whatsapp.dto.WhatsAppMediaMessageRequests.DocumentBody;
import br.com.vilareal.whatsapp.dto.WhatsAppMediaMessageRequests.DocumentMessageRequest;
import br.com.vilareal.whatsapp.dto.WhatsAppMediaMessageRequests.ImageBody;
import br.com.vilareal.whatsapp.dto.WhatsAppMediaMessageRequests.ImageMessageRequest;
import br.com.vilareal.whatsapp.dto.WhatsAppMediaMessageRequests.VideoBody;
import br.com.vilareal.whatsapp.dto.WhatsAppMediaMessageRequests.VideoMessageRequest;
import br.com.vilareal.whatsapp.dto.WhatsAppNotificationDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppSendResponse;
import br.com.vilareal.whatsapp.dto.WhatsAppTemplateMessageRequest;
import br.com.vilareal.whatsapp.dto.WhatsAppTemplateMessageRequest.Component;
import br.com.vilareal.whatsapp.dto.WhatsAppTemplateMessageRequest.Language;
import br.com.vilareal.whatsapp.dto.WhatsAppTemplateMessageRequest.Parameter;
import br.com.vilareal.whatsapp.dto.WhatsAppTemplateMessageRequest.Template;
import br.com.vilareal.whatsapp.dto.WhatsAppTextMessageRequest;
import br.com.vilareal.whatsapp.dto.WhatsAppTextMessageRequest.TextBody;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.AniversarioWhatsAppRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.CobrancaWhatsAppRepository;
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
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Envio de mensagens via WhatsApp Business Cloud API (Meta Graph).
 */
@Service
public class WhatsAppService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppService.class);
    private static final int JANELA_CONTEXTO_INBOUND_DIAS = 30;

    private final WhatsAppConfig whatsAppConfig;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final WhatsAppMessageRepository whatsAppMessageRepository;
    private final PessoaContatoRepository pessoaContatoRepository;
    private final ClienteRepository clienteRepository;
    private final ClienteWhatsAppRepository clienteWhatsAppRepository;
    private final AniversarioWhatsAppRepository aniversarioWhatsAppRepository;
    private final CobrancaWhatsAppRepository cobrancaWhatsAppRepository;
    private final WhatsAppAIService whatsAppAIService;
    private final WhatsAppIAConfigService whatsAppIAConfigService;
    private final WhatsAppMediaProcessingService whatsAppMediaProcessingService;
    private final WhatsAppNotificationService whatsAppNotificationService;
    private final WhatsAppConversationContextService conversationContextService;

    public WhatsAppService(
            WhatsAppConfig whatsAppConfig,
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            WhatsAppMessageRepository whatsAppMessageRepository,
            PessoaContatoRepository pessoaContatoRepository,
            ClienteRepository clienteRepository,
            ClienteWhatsAppRepository clienteWhatsAppRepository,
            AniversarioWhatsAppRepository aniversarioWhatsAppRepository,
            CobrancaWhatsAppRepository cobrancaWhatsAppRepository,
            @Lazy WhatsAppAIService whatsAppAIService,
            WhatsAppIAConfigService whatsAppIAConfigService,
            WhatsAppMediaProcessingService whatsAppMediaProcessingService,
            WhatsAppNotificationService whatsAppNotificationService,
            WhatsAppConversationContextService conversationContextService) {
        this.whatsAppConfig = whatsAppConfig;
        this.objectMapper = objectMapper;
        this.whatsAppMessageRepository = whatsAppMessageRepository;
        this.pessoaContatoRepository = pessoaContatoRepository;
        this.clienteRepository = clienteRepository;
        this.clienteWhatsAppRepository = clienteWhatsAppRepository;
        this.aniversarioWhatsAppRepository = aniversarioWhatsAppRepository;
        this.cobrancaWhatsAppRepository = cobrancaWhatsAppRepository;
        this.whatsAppAIService = whatsAppAIService;
        this.whatsAppIAConfigService = whatsAppIAConfigService;
        this.whatsAppMediaProcessingService = whatsAppMediaProcessingService;
        this.whatsAppNotificationService = whatsAppNotificationService;
        this.conversationContextService = conversationContextService;

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
        return sendTemplateMessage(phoneNumber, templateName, languageCode, parameters, null, null);
    }

    public WhatsAppSendResponse sendTemplateMessage(
            String phoneNumber,
            String templateName,
            String languageCode,
            List<String> parameters,
            Long clienteId,
            Long processoId) {
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
        persistOutboundMessage(
                response, formattedPhone, WhatsAppMessageType.TEMPLATE, content, templateName, clienteId, processoId);
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

    /**
     * Envia mensagem de mídia referenciando {@code media_id} já obtido via upload Meta.
     * Não persiste — use {@link #persistOutboundMediaMessage} após confirmação da Meta.
     */
    public WhatsAppSendResponse sendMediaMessage(
            String phoneNumber,
            WhatsAppMediaCategory category,
            String mediaId,
            String filename,
            String caption) {
        String formattedPhone = formatPhoneNumber(phoneNumber);
        log.info(
                "Enviando mídia {} para {}",
                category.metaMessageType(),
                maskPhoneNumber(formattedPhone));

        Object request = montarMediaMessageRequest(category, formattedPhone, mediaId, filename, caption);
        return executeSend(
                request,
                formattedPhone,
                "mensagem de " + category.metaMessageType(),
                SendContext.media(category, filename, caption));
    }

    /**
     * Persiste mensagem outbound de mídia após envio confirmado pela Meta.
     *
     * @return id da linha em {@code whatsapp_messages}
     */
    @Transactional
    public Long persistOutboundMediaMessage(
            WhatsAppSendResponse response,
            String formattedPhone,
            WhatsAppMediaCategory category,
            String mediaId,
            String mime,
            String filename,
            String caption,
            String contactName) {
        String waMessageId = extractMessageId(response);
        if (!StringUtils.hasText(waMessageId) || "desconhecido".equals(waMessageId)) {
            throw new IllegalStateException("Resposta Meta sem waMessageId — mensagem não persistida.");
        }

        WhatsAppMessageEntity msg = new WhatsAppMessageEntity();
        msg.setWaMessageId(waMessageId);
        msg.setPhoneNumber(formattedPhone);
        msg.setContactName(contactName);
        msg.setDirection(WhatsAppMessageDirection.OUTBOUND);
        msg.setMessageType(category.toMessageType());
        msg.setContent(montarConteudoOutboundMedia(category, filename, caption));
        msg.setStatus(WhatsAppMessageStatus.SENT);
        msg.setMediaId(mediaId);
        msg.setMediaMimeType(mime);
        msg.setMediaFilename(filename);
        msg.setMediaStatus(WhatsAppMediaStatus.PENDING);
        msg.setCreatedAt(Instant.now());

        try {
            WhatsAppMessageEntity saved = whatsAppMessageRepository.save(msg);
            log.info(
                    "Mensagem outbound de mídia salva. ID: {}, tipo: {}, media_id: {}",
                    saved.getId(),
                    category,
                    mediaId);
            return saved.getId();
        } catch (Exception e) {
            log.error("Falha ao salvar mensagem outbound de mídia no banco: {}", e.getMessage());
            throw new IllegalStateException("Falha ao persistir mensagem outbound de mídia.", e);
        }
    }

    @Transactional
    public void processInboundMessage(
            String from,
            String body,
            String type,
            String waMessageId,
            String contactName,
            String mediaId,
            String mimeType,
            String filename) {
        processInboundMessage(
                from, body, type, waMessageId, contactName, mediaId, mimeType, filename, Instant.now());
    }

    @Transactional
    public void processInboundMessage(
            String from,
            String body,
            String type,
            String waMessageId,
            String contactName,
            String mediaId,
            String mimeType,
            String filename,
            Instant receivedAt) {
        if (!StringUtils.hasText(waMessageId)) {
            log.warn("Mensagem inbound ignorada: waMessageId ausente");
            return;
        }

        if (whatsAppMessageRepository.findByWaMessageId(waMessageId).isPresent()) {
            log.debug("Mensagem inbound duplicada ignorada: {}", waMessageId);
            return;
        }

        WhatsAppMessageType messageType = parseMessageType(type);
        String content = montarConteudoInbound(body, messageType, filename);

        WhatsAppMessageEntity msg = new WhatsAppMessageEntity();
        msg.setWaMessageId(waMessageId);
        msg.setPhoneNumber(from);
        msg.setContactName(contactName);
        msg.setDirection(WhatsAppMessageDirection.INBOUND);
        msg.setMessageType(messageType);
        msg.setContent(content);
        msg.setStatus(WhatsAppMessageStatus.RECEIVED);
        msg.setMediaId(mediaId);
        msg.setMediaMimeType(mimeType);
        msg.setMediaFilename(filename);
        if (StringUtils.hasText(mediaId)) {
            msg.setMediaStatus(WhatsAppMediaStatus.PENDING);
        }
        msg.setCreatedAt(receivedAt != null ? receivedAt : Instant.now());

        Long clienteId = resolveClienteId(from);
        Long processoId = resolveProcessoIdInbound(from);
        if (clienteId == null) {
            clienteId = resolveClienteIdInbound(from, processoId);
        }
        msg.setClienteId(clienteId);
        msg.setProcessoId(processoId);

        WhatsAppMessageEntity saved;
        try {
            saved = whatsAppMessageRepository.save(msg);
            log.info(
                    "Mensagem inbound salva. ID: {}, Cliente: {}, tipo: {}",
                    saved.getId(),
                    clienteId != null ? clienteId : "não identificado",
                    messageType);
        } catch (Exception e) {
            log.error("Falha ao salvar mensagem inbound no banco: {}", e.getMessage());
            return;
        }

        try {
            Instant createdAt = saved.getCreatedAt() != null ? saved.getCreatedAt() : Instant.now();
            whatsAppNotificationService.notifyNewMessage(new WhatsAppNotificationDTO(
                    saved.getId(),
                    from,
                    formatPhoneDisplay(from),
                    contactName,
                    content,
                    messageType.name(),
                    WhatsAppMessageDirection.INBOUND.name(),
                    createdAt));
        } catch (Exception e) {
            log.warn("Falha ao notificar mensagem inbound via SSE: {}", e.getMessage());
        }

        if (StringUtils.hasText(mediaId)) {
            whatsAppMediaProcessingService.agendarProcessamentoMidia(
                    waMessageId, mediaId, filename, mimeType, contactName, from);
        }

        boolean hasText = body != null && !body.isBlank();
        boolean acionarIa = messageType != WhatsAppMessageType.CONTACT && (hasText || StringUtils.hasText(mediaId));
        if (acionarIa && whatsAppIAConfigService.isIaHabilitada()) {
            try {
                String aiInput = hasText ? body : content;
                whatsAppAIService.handleIncomingMessage(from, aiInput, contactName);
            } catch (Exception e) {
                log.error("Falha ao processar mensagem inbound com IA: {}", e.getMessage(), e);
            }
        } else if (acionarIa) {
            log.debug("Resposta automática WhatsApp IA desligada — mensagem de {} registrada sem IA", from);
        }
    }

    /** Compatibilidade com chamadas legadas sem metadados de mídia. */
    @Transactional
    public void processInboundMessage(
            String from, String body, String type, String waMessageId, String contactName) {
        processInboundMessage(from, body, type, waMessageId, contactName, null, null, null, Instant.now());
    }

    private static String montarConteudoInbound(String body, WhatsAppMessageType messageType, String filename) {
        if (body != null && !body.isBlank()) {
            return body;
        }
        return switch (messageType) {
            case IMAGE -> "📷 Imagem recebida" + suffixFilename(filename);
            case DOCUMENT -> "📎 Documento recebido" + suffixFilename(filename);
            case AUDIO -> "🎤 Áudio recebido";
            case VIDEO -> "🎬 Vídeo recebido" + suffixFilename(filename);
            case CONTACT -> body != null && !body.isBlank()
                    ? body
                    : "👤 Cartão de contato";
            default -> "📩 Mídia recebida";
        };
    }

    private static String suffixFilename(String filename) {
        return filename != null && !filename.isBlank() ? ": " + filename : "";
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
            whatsAppNotificationService.notifyStatusUpdate(waMessageId, newStatus);
            if (WhatsAppTemplateService.TEMPLATE_ANIVERSARIO.equals(msg.getTemplateName())) {
                aniversarioWhatsAppRepository.findByWaMessageId(waMessageId).ifPresent(aniv -> {
                    aniv.setStatus(parsedStatus.name());
                    aniversarioWhatsAppRepository.save(aniv);
                });
            }
            String cobrancaStatus = CobrancaWhatsAppService.mapWebhookStatus(newStatus);
            if (cobrancaStatus != null) {
                cobrancaWhatsAppRepository.findByWaMessageId(waMessageId).ifPresent(c -> {
                    c.setStatus(cobrancaStatus);
                    cobrancaWhatsAppRepository.save(c);
                });
            }
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

        static SendContext media(WhatsAppMediaCategory category, String filename, String caption) {
            String resumo = category.metaMessageType();
            if (StringUtils.hasText(filename)) {
                resumo += ": " + filename;
            } else if (StringUtils.hasText(caption)) {
                resumo += ": " + caption;
            }
            return new SendContext(false, "mídia", resumo);
        }
    }

    private static Object montarMediaMessageRequest(
            WhatsAppMediaCategory category,
            String formattedPhone,
            String mediaId,
            String filename,
            String caption) {
        String trimmedCaption = StringUtils.hasText(caption) ? caption.trim() : null;
        return switch (category) {
            case IMAGE -> new ImageMessageRequest(
                    "whatsapp",
                    "individual",
                    formattedPhone,
                    "image",
                    new ImageBody(mediaId, trimmedCaption));
            case DOCUMENT -> new DocumentMessageRequest(
                    "whatsapp",
                    "individual",
                    formattedPhone,
                    "document",
                    new DocumentBody(mediaId, filename, trimmedCaption));
            case AUDIO -> new AudioMessageRequest(
                    "whatsapp", "individual", formattedPhone, "audio", new AudioBody(mediaId));
            case VIDEO -> new VideoMessageRequest(
                    "whatsapp",
                    "individual",
                    formattedPhone,
                    "video",
                    new VideoBody(mediaId, trimmedCaption));
        };
    }

    static String montarConteudoOutboundMedia(
            WhatsAppMediaCategory category, String filename, String caption) {
        if (StringUtils.hasText(caption)) {
            return caption.trim();
        }
        return switch (category) {
            case IMAGE -> "📷 Imagem";
            case DOCUMENT -> {
                if (StringUtils.hasText(filename)) {
                    yield "📄 " + filename.trim();
                }
                yield "📄 Documento";
            }
            case AUDIO -> "🎵 Áudio";
            case VIDEO -> "🎥 Vídeo";
        };
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
        persistOutboundMessage(response, formattedPhone, messageType, content, templateName, null, null);
    }

    private void persistOutboundMessage(
            WhatsAppSendResponse response,
            String formattedPhone,
            WhatsAppMessageType messageType,
            String content,
            String templateName,
            Long clienteId,
            Long processoId) {
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
        msg.setClienteId(clienteId);
        msg.setProcessoId(processoId);
        msg.setCreatedAt(Instant.now());

        try {
            whatsAppMessageRepository.save(msg);
        } catch (Exception e) {
            log.error("Falha ao salvar mensagem enviada no banco: {}", e.getMessage());
        }
    }

    private Long resolveProcessoIdInbound(String phoneFrom) {
        Instant since = Instant.now().minus(JANELA_CONTEXTO_INBOUND_DIAS, ChronoUnit.DAYS);
        Optional<WhatsAppMessageEntity> ultimaOutbound = whatsAppMessageRepository
                .findFirstByPhoneNumberAndDirectionAndProcessoIdIsNotNullAndCreatedAtAfterOrderByCreatedAtDesc(
                        phoneFrom, WhatsAppMessageDirection.OUTBOUND, since);
        if (ultimaOutbound.isPresent()) {
            return ultimaOutbound.get().getProcessoId();
        }

        var contexto = conversationContextService.resolverContextoMaisRecente(phoneFrom);
        if (contexto != null && contexto.processoId() != null) {
            return contexto.processoId();
        }
        return null;
    }

    private Long resolveClienteIdInbound(String phoneFrom, Long processoId) {
        Instant since = Instant.now().minus(JANELA_CONTEXTO_INBOUND_DIAS, ChronoUnit.DAYS);
        Optional<WhatsAppMessageEntity> ultimaOutbound = whatsAppMessageRepository
                .findFirstByPhoneNumberAndDirectionAndClienteIdIsNotNullAndCreatedAtAfterOrderByCreatedAtDesc(
                        phoneFrom, WhatsAppMessageDirection.OUTBOUND, since);
        if (ultimaOutbound.isPresent()) {
            return ultimaOutbound.get().getClienteId();
        }

        var contexto = conversationContextService.resolverContextoMaisRecente(phoneFrom);
        if (contexto != null && contexto.clienteId() != null) {
            return contexto.clienteId();
        }
        return null;
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
            case "contacts" -> WhatsAppMessageType.CONTACT;
            case "sticker" -> WhatsAppMessageType.IMAGE;
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

    /** Exposto para serviços de orquestração outbound (ex.: resultado de envio de mídia). */
    public static String extractMessageIdPublic(WhatsAppSendResponse response) {
        return extractMessageId(response);
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

    public static String formatPhoneDisplay(String phone) {
        if (!StringUtils.hasText(phone)) {
            return "";
        }
        String digits = phone.replaceAll("\\D", "");
        if (digits.startsWith("55") && digits.length() >= 12) {
            String ddd = digits.substring(2, 4);
            String rest = digits.substring(4);
            if (rest.length() == 9) {
                return "(%s) %s-%s".formatted(ddd, rest.substring(0, 5), rest.substring(5));
            }
            if (rest.length() == 8) {
                return "(%s) %s-%s".formatted(ddd, rest.substring(0, 4), rest.substring(4));
            }
        }
        return phone;
    }

    private static String maskPhoneNumber(String digits) {
        if (digits == null || digits.length() < 8) {
            return "****";
        }
        return digits.substring(0, 5) + "****" + digits.substring(digits.length() - 4);
    }
}
