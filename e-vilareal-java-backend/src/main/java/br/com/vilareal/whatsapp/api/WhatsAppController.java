package br.com.vilareal.whatsapp.api;

import br.com.vilareal.config.WhatsAppConfig;
import br.com.vilareal.whatsapp.ScheduledMessageStatus;
import br.com.vilareal.whatsapp.WhatsAppApiException;
import br.com.vilareal.whatsapp.WhatsAppContactCardSupport;
import br.com.vilareal.whatsapp.WhatsAppInteractiveReplySupport;
import br.com.vilareal.whatsapp.WhatsAppLocationSupport;
import br.com.vilareal.whatsapp.WhatsAppMediaMimeUtil;
import br.com.vilareal.whatsapp.WhatsAppMessageDtoMapper;
import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.WhatsAppMessageStatus;
import br.com.vilareal.whatsapp.dto.CreateTemplateRequest;
import br.com.vilareal.whatsapp.dto.ScheduleMessageRequest;
import br.com.vilareal.whatsapp.dto.ScheduleMessageResponse;
import br.com.vilareal.whatsapp.dto.SendMediaMessageResponse;
import br.com.vilareal.whatsapp.dto.SendMessageResponse;
import br.com.vilareal.whatsapp.dto.SendTemplateRequest;
import br.com.vilareal.whatsapp.dto.SendTextRequest;
import br.com.vilareal.whatsapp.dto.ScheduledMessageDTO;
import br.com.vilareal.whatsapp.dto.RecentConversationDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppIaHabilitadaDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppConversationDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppMessageDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppProcessoContextItemDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository.ConversationSummaryRow;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository.RecentConversationRow;
import br.com.vilareal.whatsapp.dto.WhatsAppSendResponse;
import br.com.vilareal.whatsapp.dto.WhatsAppStatsDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.ScheduledWhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.ScheduledWhatsAppMessageRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import br.com.vilareal.whatsapp.dto.WhatsAppTemplateDTO;
import br.com.vilareal.whatsapp.service.WhatsAppAgendamentosFeedService;
import br.com.vilareal.whatsapp.service.WhatsAppContactResolverService;
import br.com.vilareal.whatsapp.service.WhatsAppConversationReadService;
import br.com.vilareal.whatsapp.service.WhatsAppConversationContextService;
import br.com.vilareal.whatsapp.service.WhatsAppConversationFeedService;
import br.com.vilareal.whatsapp.service.WhatsAppIAConfigService;
import br.com.vilareal.whatsapp.service.WhatsAppNotificationService;
import br.com.vilareal.whatsapp.service.WhatsAppTemplateService;
import br.com.vilareal.whatsapp.service.WhatsAppOutboundMediaService;
import br.com.vilareal.whatsapp.service.WhatsAppSchedulerService;
import br.com.vilareal.whatsapp.service.WhatsAppService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.nio.file.Files;
import java.nio.file.Path;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/whatsapp")
@Tag(name = "WhatsApp", description = "Envio, histórico, agendamentos e estatísticas WhatsApp Business")
public class WhatsAppController {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppController.class);
    private static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");

    private final WhatsAppService whatsAppService;
    private final WhatsAppSchedulerService whatsAppSchedulerService;
    private final WhatsAppMessageRepository whatsAppMessageRepository;
    private final ScheduledWhatsAppMessageRepository scheduledWhatsAppMessageRepository;
    private final ObjectMapper objectMapper;
    private final WhatsAppConfig whatsAppConfig;
    private final WhatsAppContactResolverService contactResolver;
    private final WhatsAppTemplateService whatsAppTemplateService;
    private final WhatsAppNotificationService whatsAppNotificationService;
    private final WhatsAppAgendamentosFeedService agendamentosFeedService;
    private final WhatsAppIAConfigService whatsAppIAConfigService;
    private final WhatsAppConversationContextService conversationContextService;
    private final WhatsAppConversationFeedService conversationFeedService;
    private final WhatsAppOutboundMediaService outboundMediaService;
    private final WhatsAppConversationReadService conversationReadService;

    public WhatsAppController(
            WhatsAppService whatsAppService,
            WhatsAppSchedulerService whatsAppSchedulerService,
            WhatsAppMessageRepository whatsAppMessageRepository,
            ScheduledWhatsAppMessageRepository scheduledWhatsAppMessageRepository,
            ObjectMapper objectMapper,
            WhatsAppConfig whatsAppConfig,
            WhatsAppContactResolverService contactResolver,
            WhatsAppTemplateService whatsAppTemplateService,
            WhatsAppNotificationService whatsAppNotificationService,
            WhatsAppAgendamentosFeedService agendamentosFeedService,
            WhatsAppIAConfigService whatsAppIAConfigService,
            WhatsAppConversationContextService conversationContextService,
            WhatsAppConversationFeedService conversationFeedService,
            WhatsAppOutboundMediaService outboundMediaService,
            WhatsAppConversationReadService conversationReadService) {
        this.whatsAppService = whatsAppService;
        this.whatsAppSchedulerService = whatsAppSchedulerService;
        this.whatsAppMessageRepository = whatsAppMessageRepository;
        this.scheduledWhatsAppMessageRepository = scheduledWhatsAppMessageRepository;
        this.objectMapper = objectMapper;
        this.whatsAppConfig = whatsAppConfig;
        this.contactResolver = contactResolver;
        this.whatsAppTemplateService = whatsAppTemplateService;
        this.whatsAppNotificationService = whatsAppNotificationService;
        this.agendamentosFeedService = agendamentosFeedService;
        this.whatsAppIAConfigService = whatsAppIAConfigService;
        this.conversationContextService = conversationContextService;
        this.conversationFeedService = conversationFeedService;
        this.outboundMediaService = outboundMediaService;
        this.conversationReadService = conversationReadService;
    }

    @GetMapping("/ia/habilitada")
    @Operation(summary = "Estado do interruptor da resposta automática (IA) do WhatsApp")
    public ResponseEntity<WhatsAppIaHabilitadaDTO> obterIaHabilitada() {
        return ResponseEntity.ok(new WhatsAppIaHabilitadaDTO(whatsAppIAConfigService.isIaHabilitada()));
    }

    @PutMapping("/ia/habilitada")
    @Operation(summary = "Liga ou desliga a resposta automática (IA) do WhatsApp")
    public ResponseEntity<WhatsAppIaHabilitadaDTO> atualizarIaHabilitada(
            @RequestBody WhatsAppIaHabilitadaDTO body) {
        boolean habilitada = body != null && body.habilitada();
        return ResponseEntity.ok(new WhatsAppIaHabilitadaDTO(whatsAppIAConfigService.salvarIaHabilitada(habilitada)));
    }

    @PostMapping("/send")
    @Operation(summary = "Enviar mensagem de texto")
    public ResponseEntity<SendMessageResponse> sendMessage(@Valid @RequestBody SendTextRequest request) {
        try {
            WhatsAppSendResponse response = whatsAppService.sendTextMessage(request.phoneNumber(), request.message());
            return ResponseEntity.ok(new SendMessageResponse(true, extractMessageId(response), null));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new SendMessageResponse(false, null, e.getMessage()));
        } catch (WhatsAppApiException e) {
            return ResponseEntity.status(mapWhatsAppHttpStatus(e))
                    .body(new SendMessageResponse(false, null, e.getMessage()));
        }
    }

    @PostMapping(value = "/send-media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Enviar mídia (imagem, documento, áudio ou vídeo)")
    public ResponseEntity<SendMediaMessageResponse> sendMedia(
            @RequestParam String phoneNumber,
            @RequestParam(value = "caption", required = false) String caption,
            @RequestParam("arquivo") MultipartFile arquivo) {
        if (arquivo == null || arquivo.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new SendMediaMessageResponse(false, null, null, null, "Arquivo de mídia ausente."));
        }
        if (!StringUtils.hasText(phoneNumber)) {
            return ResponseEntity.badRequest()
                    .body(new SendMediaMessageResponse(false, null, null, null, "Telefone é obrigatório."));
        }

        String filename = WhatsAppMediaMimeUtil.sanitizarFilename(arquivo.getOriginalFilename());
        String mime = WhatsAppMediaMimeUtil.resolverMime(arquivo, filename);
        Path tempPath = null;

        try {
            String suffix = inferirSufixoTemp(filename);
            tempPath = Files.createTempFile("wa-out-upload-", suffix);
            arquivo.transferTo(tempPath);

            var result = outboundMediaService.enviarMidia(phoneNumber, tempPath, filename, mime, caption);
            tempPath = null;

            return ResponseEntity.ok(new SendMediaMessageResponse(
                    true,
                    result.messageId(),
                    result.waMessageId(),
                    result.mediaStatus() != null ? result.mediaStatus().name() : null,
                    null));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(new SendMediaMessageResponse(false, null, null, null, e.getMessage()));
        } catch (WhatsAppApiException e) {
            return ResponseEntity.status(mapWhatsAppHttpStatus(e))
                    .body(new SendMediaMessageResponse(false, null, null, null, e.getMessage()));
        } catch (Exception e) {
            log.error("Falha ao enviar mídia WhatsApp: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new SendMediaMessageResponse(
                            false, null, null, null, "Falha ao processar envio de mídia."));
        } finally {
            if (tempPath != null) {
                try {
                    Files.deleteIfExists(tempPath);
                } catch (Exception e) {
                    log.warn("Falha ao remover temp de upload send-media: {}", e.getMessage());
                }
            }
        }
    }

    private static String inferirSufixoTemp(String filename) {
        if (!StringUtils.hasText(filename)) {
            return ".bin";
        }
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot >= filename.length() - 1) {
            return ".bin";
        }
        String ext = filename.substring(dot).replaceAll("[^a-zA-Z0-9.]", "");
        if (ext.length() > 12) {
            ext = ext.substring(0, 12);
        }
        return StringUtils.hasText(ext) ? ext : ".bin";
    }

    @PostMapping("/send-template")
    @Operation(summary = "Enviar mensagem com template aprovado")
    public ResponseEntity<SendMessageResponse> sendTemplate(@Valid @RequestBody SendTemplateRequest request) {
        try {
            String languageCode =
                    StringUtils.hasText(request.languageCode()) ? request.languageCode() : "pt_BR";
            WhatsAppSendResponse response = whatsAppService.sendTemplateMessage(
                    request.phoneNumber(), request.templateName(), languageCode, request.parameters());
            return ResponseEntity.ok(new SendMessageResponse(true, extractMessageId(response), null));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new SendMessageResponse(false, null, e.getMessage()));
        } catch (WhatsAppApiException e) {
            return ResponseEntity.status(mapWhatsAppHttpStatus(e))
                    .body(new SendMessageResponse(false, null, e.getMessage()));
        }
    }

    @GetMapping("/conversations")
    @Operation(summary = "Listar conversas recentes (última mensagem por telefone)")
    public ResponseEntity<Page<WhatsAppConversationDTO>> getConversations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Page<ConversationSummaryRow> rows =
                whatsAppMessageRepository.findConversationSummariesExcluindoAniversario(PageRequest.of(page, size));
        List<String> phones = rows.getContent().stream()
                .map(ConversationSummaryRow::getPhoneNumber)
                .toList();
        Map<String, List<WhatsAppProcessoContextItemDTO>> contextosPorTelefone =
                conversationContextService.resolverPorTelefones(phones);
        return ResponseEntity.ok(rows.map(row -> toConversationDto(
                row, contextosPorTelefone.getOrDefault(row.getPhoneNumber(), List.of()))));
    }

    @GetMapping("/conversations/context")
    @Operation(summary = "Contexto de processo/unidade inferido de cobranças recentes para um telefone")
    public ResponseEntity<List<WhatsAppProcessoContextItemDTO>> getConversationContext(
            @RequestParam String phoneNumber) {
        try {
            String normalized = WhatsAppService.formatPhoneNumber(phoneNumber);
            return ResponseEntity.ok(conversationContextService.resolverContextos(normalized));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/conversations/unread-total")
    @Operation(summary = "Número de conversas com mensagens recebidas não lidas (leitura interna global)")
    public ResponseEntity<Map<String, Long>> getConversationsUnreadTotal() {
        long total = conversationReadService.contarConversasNaoLidas();
        return ResponseEntity.ok(Map.of("unreadConversations", total));
    }

    @PostMapping("/conversations/{phoneNumber}/marcar-lida")
    @Operation(summary = "Marca conversa como lida globalmente (estado interno do escritório)")
    public ResponseEntity<Void> marcarConversaComoLida(@PathVariable String phoneNumber) {
        try {
            conversationReadService.marcarComoLida(phoneNumber);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/conversations/recent")
    @Operation(summary = "Conversas recentes com mensagens recebidas (para chat flutuante)")
    public ResponseEntity<List<RecentConversationDTO>> getRecentConversations(
            @RequestParam(defaultValue = "10") int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 50);
        List<RecentConversationRow> rows =
                whatsAppMessageRepository.findRecentConversationsWithInbound(PageRequest.of(0, safeLimit));
        return ResponseEntity.ok(rows.stream().map(this::toRecentConversationDto).toList());
    }

    @GetMapping(value = "/notifications/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Stream SSE de notificações WhatsApp em tempo real")
    public SseEmitter streamNotifications() {
        return whatsAppNotificationService.subscribe();
    }

    @GetMapping("/notifications/unread-count")
    @Operation(summary = "Contagem de mensagens recebidas nas últimas 24h")
    public ResponseEntity<Map<String, Long>> getUnreadCount() {
        Instant since = Instant.now().minus(24, ChronoUnit.HOURS);
        long count = whatsAppMessageRepository.countByDirectionAndCreatedAtAfter(
                WhatsAppMessageDirection.INBOUND, since);
        return ResponseEntity.ok(Map.of("unreadCount", count));
    }

    @GetMapping("/messages")
    @Operation(summary = "Listar mensagens por telefone")
    public ResponseEntity<Page<WhatsAppMessageDTO>> getMessages(
            @RequestParam String phoneNumber,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            return ResponseEntity.ok(conversationFeedService.listarMensagens(phoneNumber, PageRequest.of(page, size)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/messages/cliente/{clienteId}")
    @Operation(summary = "Listar mensagens de um cliente")
    public ResponseEntity<Page<WhatsAppMessageDTO>> getMessagesByCliente(
            @PathVariable Long clienteId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<WhatsAppMessageEntity> messages = whatsAppMessageRepository.findByClienteIdOrderByCreatedAtDesc(
                clienteId, PageRequest.of(page, size));
        return ResponseEntity.ok(messages.map(this::toMessageDto));
    }

    @GetMapping("/scheduled")
    @Operation(summary = "Listar agendamentos de mensagens (inclui cobranças em lote)")
    public ResponseEntity<Page<ScheduledMessageDTO>> getScheduled(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (StringUtils.hasText(status)) {
            try {
                ScheduledMessageStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().build();
            }
        }
        return ResponseEntity.ok(agendamentosFeedService.listar(status, PageRequest.of(page, size)));
    }

    @PostMapping("/schedule")
    @Operation(summary = "Criar agendamento de mensagem")
    public ResponseEntity<ScheduleMessageResponse> schedule(@Valid @RequestBody ScheduleMessageRequest request) {
        try {
            ScheduledWhatsAppMessageEntity entity = whatsAppSchedulerService.agendarMensagem(
                    request.phoneNumber(),
                    request.templateName(),
                    request.parameters(),
                    request.scheduledAt(),
                    request.clienteId(),
                    request.processoId(),
                    resolveCreatedBy(),
                    request.descricao());
            return ResponseEntity.ok(new ScheduleMessageResponse(
                    true, entity.getId(), entity.getScheduledAt(), null));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ScheduleMessageResponse(false, null, null, e.getMessage()));
        }
    }

    @DeleteMapping("/schedule/{id}")
    @Operation(summary = "Cancelar agendamento pendente")
    public ResponseEntity<Void> cancelSchedule(@PathVariable Long id) {
        try {
            whatsAppSchedulerService.cancelarAgendamento(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/templates")
    @Operation(summary = "Listar templates de mensagem (Meta)")
    public ResponseEntity<List<WhatsAppTemplateDTO>> listTemplates() {
        try {
            return ResponseEntity.ok(whatsAppTemplateService.listarTemplates());
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        } catch (WhatsAppApiException e) {
            return ResponseEntity.status(mapWhatsAppHttpStatus(e)).build();
        }
    }

    @PostMapping("/templates")
    @Operation(summary = "Criar template de mensagem (Meta)")
    public ResponseEntity<WhatsAppTemplateDTO> createTemplate(@Valid @RequestBody CreateTemplateRequest request) {
        try {
            WhatsAppTemplateDTO created = whatsAppTemplateService.criarTemplate(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        } catch (WhatsAppApiException e) {
            return ResponseEntity.status(mapWhatsAppHttpStatus(e)).build();
        }
    }

    @DeleteMapping("/templates/{name}")
    @Operation(summary = "Deletar template de mensagem (Meta)")
    public ResponseEntity<SendMessageResponse> deleteTemplate(
            @PathVariable String name, @RequestParam(required = false) String hsmId) {
        try {
            whatsAppTemplateService.deletarTemplate(name, hsmId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new SendMessageResponse(false, null, e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(new SendMessageResponse(false, null, "Integração WhatsApp não configurada."));
        } catch (WhatsAppApiException e) {
            return ResponseEntity.status(mapWhatsAppHttpStatus(e))
                    .body(new SendMessageResponse(false, null, e.getMessage()));
        }
    }

    @GetMapping("/stats")
    @Operation(summary = "Estatísticas de mensagens WhatsApp")
    public ResponseEntity<WhatsAppStatsDTO> getStats() {
        Instant startOfToday = LocalDate.now(ZONE_BRASILIA)
                .atStartOfDay(ZONE_BRASILIA)
                .toInstant();

        long sentToday = whatsAppMessageRepository.countByDirectionAndCreatedAtAfter(
                WhatsAppMessageDirection.OUTBOUND, startOfToday);
        long receivedToday = whatsAppMessageRepository.countByDirectionAndCreatedAtAfter(
                WhatsAppMessageDirection.INBOUND, startOfToday);
        long scheduledPending = agendamentosFeedService.contarPendentes();
        long failedToday = whatsAppMessageRepository.countByStatusAndCreatedAtAfter(
                WhatsAppMessageStatus.FAILED, startOfToday);

        return ResponseEntity.ok(new WhatsAppStatsDTO(
                sentToday,
                receivedToday,
                scheduledPending,
                failedToday,
                integracaoWhatsAppConfigurada(),
                Instant.now()));
    }

    private boolean integracaoWhatsAppConfigurada() {
        String token = whatsAppConfig.getAccessToken();
        String phoneId = whatsAppConfig.getPhoneNumberId();
        if (!StringUtils.hasText(token) || !StringUtils.hasText(phoneId)) {
            return false;
        }
        String tokenLower = token.toLowerCase(Locale.ROOT);
        if (tokenLower.contains("placeholder") || tokenLower.contains("token-placeholder")) {
            return false;
        }
        return !"123456789".equals(phoneId.trim());
    }

    private WhatsAppConversationDTO toConversationDto(
            ConversationSummaryRow row, List<WhatsAppProcessoContextItemDTO> contextos) {
        String preview = previewFromRow(row);
        if (StringUtils.hasText(preview) && preview.length() > 120) {
            preview = preview.substring(0, 117) + "...";
        }
        List<WhatsAppProcessoContextItemDTO> safeContextos =
                contextos != null ? contextos : List.of();
        WhatsAppProcessoContextItemDTO principal =
                safeContextos.isEmpty() ? null : safeContextos.getFirst();
        return new WhatsAppConversationDTO(
                row.getPhoneNumber(),
                contactResolver.resolveContactName(row.getPhoneNumber(), row.getContactName()),
                preview,
                row.getLastMessageDirection(),
                row.getLastMessageType(),
                row.getLastMessageAt(),
                unreadCountOf(row.getUnreadCount()),
                principal,
                safeContextos);
    }

    private static String previewFromRow(ConversationSummaryRow row) {
        String type = row.getLastMessageType();
        if (StringUtils.hasText(type)) {
            return switch (type.toUpperCase(Locale.ROOT)) {
                case "IMAGE" -> "📷 Imagem";
                case "DOCUMENT" -> "📎 Documento";
                case "AUDIO" -> "🎤 Áudio";
                case "VIDEO" -> "🎬 Vídeo";
                case "CONTACT" -> previewContato(row.getLastMessageContent());
                case "LOCATION" -> WhatsAppLocationSupport.resumoLegivel(row.getLastMessageContent());
                case "INTERACTIVE", "BUTTON" ->
                        WhatsAppInteractiveReplySupport.resumoLegivel(row.getLastMessageContent());
                default -> row.getLastMessageContent();
            };
        }
        String preview = row.getLastMessageContent();
        if (!StringUtils.hasText(preview) && StringUtils.hasText(row.getLastMessageDirection())) {
            preview = "OUTBOUND".equalsIgnoreCase(row.getLastMessageDirection())
                    ? "Mensagem enviada"
                    : "Mensagem recebida";
        }
        return preview;
    }

    private RecentConversationDTO toRecentConversationDto(RecentConversationRow row) {
        String preview = previewFromRecentRow(row);
        if (StringUtils.hasText(preview) && preview.length() > 120) {
            preview = preview.substring(0, 117) + "...";
        }
        return new RecentConversationDTO(
                row.getPhoneNumber(),
                WhatsAppService.formatPhoneDisplay(row.getPhoneNumber()),
                contactResolver.resolveContactName(row.getPhoneNumber(), row.getContactName()),
                preview,
                row.getLastMessageType(),
                row.getLastMessageAt(),
                row.getTotalMessages() != null ? row.getTotalMessages() : 0L,
                unreadCountOf(row.getUnreadCount()));
    }

    private static String previewFromRecentRow(RecentConversationRow row) {
        String type = row.getLastMessageType();
        if (StringUtils.hasText(type)) {
            return switch (type.toUpperCase(Locale.ROOT)) {
                case "IMAGE" -> "📷 Imagem";
                case "DOCUMENT" -> "📎 Documento";
                case "AUDIO" -> "🎤 Áudio";
                case "VIDEO" -> "🎬 Vídeo";
                case "CONTACT" -> previewContato(row.getLastMessageContent());
                case "LOCATION" -> WhatsAppLocationSupport.resumoLegivel(row.getLastMessageContent());
                case "INTERACTIVE", "BUTTON" ->
                        WhatsAppInteractiveReplySupport.resumoLegivel(row.getLastMessageContent());
                default -> row.getLastMessageContent();
            };
        }
        return row.getLastMessageContent();
    }

    private static String previewContato(String content) {
        return "👤 " + WhatsAppContactCardSupport.resumoLegivel(content);
    }

    private static long unreadCountOf(Long unreadCount) {
        return unreadCount != null ? unreadCount : 0L;
    }

    private WhatsAppMessageDTO toMessageDto(WhatsAppMessageEntity entity) {
        return WhatsAppMessageDtoMapper.fromEntity(
                entity,
                contactResolver.resolveContactName(
                        entity.getPhoneNumber(), entity.getContactName(), entity.getClienteId()));
    }

    private ScheduledMessageDTO toScheduledDto(ScheduledWhatsAppMessageEntity entity) {
        List<String> params = List.of();
        try {
            if (StringUtils.hasText(entity.getTemplateParams())) {
                params = objectMapper.readValue(entity.getTemplateParams(), new TypeReference<List<String>>() {});
            }
        } catch (Exception e) {
            log.warn(
                    "Erro ao deserializar templateParams do agendamento {}: {}",
                    entity.getId(),
                    e.getMessage());
        }

        return new ScheduledMessageDTO(
                entity.getId(),
                entity.getPhoneNumber(),
                entity.getTemplateName(),
                params,
                entity.getScheduledAt(),
                entity.getStatus() != null ? entity.getStatus().name() : null,
                entity.getSentAt(),
                entity.getErrorMessage(),
                entity.getRetryCount(),
                entity.getClienteId(),
                entity.getProcessoId(),
                entity.getCreatedBy(),
                entity.getDescricao(),
                entity.getCreatedAt());
    }

    private static String extractMessageId(WhatsAppSendResponse response) {
        if (response.messages() == null || response.messages().isEmpty()) {
            return null;
        }
        return response.messages().getFirst().id();
    }

    private static HttpStatus mapWhatsAppHttpStatus(WhatsAppApiException e) {
        int code = e.getHttpStatusCode();
        if (code >= 500) {
            return HttpStatus.BAD_GATEWAY;
        }
        if (code >= 400) {
            return HttpStatus.BAD_REQUEST;
        }
        return HttpStatus.BAD_GATEWAY;
    }

    private static String resolveCreatedBy() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && StringUtils.hasText(auth.getName())) {
            return auth.getName();
        }
        return "admin";
    }
}
