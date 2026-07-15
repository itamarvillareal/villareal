package br.com.vilareal.whatsapp.api;

import br.com.vilareal.config.WhatsAppConfig;
import br.com.vilareal.whatsapp.ScheduledMessageStatus;
import br.com.vilareal.whatsapp.WhatsAppApiException;
import br.com.vilareal.whatsapp.WhatsAppContactCardSupport;
import br.com.vilareal.whatsapp.WhatsAppInteractiveReplySupport;
import br.com.vilareal.whatsapp.WhatsAppLocationSupport;
import br.com.vilareal.whatsapp.WhatsAppReactionSupport;
import br.com.vilareal.whatsapp.WhatsAppMediaMimeUtil;
import br.com.vilareal.whatsapp.WhatsAppMessageDtoMapper;
import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.WhatsAppMessageStatus;
import br.com.vilareal.whatsapp.dto.WhatsAppApagarConversaResultDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppArquivarConversasLoteRequest;
import br.com.vilareal.whatsapp.dto.WhatsAppArquivarConversasLoteResultDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppFixarConversasLoteRequest;
import br.com.vilareal.whatsapp.dto.WhatsAppFixarConversasLoteResultDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppForwardMessageRequest;
import br.com.vilareal.whatsapp.dto.WhatsAppForwardMessageResponse;
import br.com.vilareal.whatsapp.dto.WhatsAppMarcarLidasLoteRequest;
import br.com.vilareal.whatsapp.dto.WhatsAppMarcarLidasLoteResultDTO;
import br.com.vilareal.whatsapp.dto.CreateTemplateRequest;
import br.com.vilareal.whatsapp.dto.IniciarTelefonesResponseDTO;
import br.com.vilareal.whatsapp.dto.JanelaAbertaResponseDTO;
import br.com.vilareal.whatsapp.dto.ScheduleMessageRequest;
import br.com.vilareal.whatsapp.dto.ScheduleMessageResponse;
import br.com.vilareal.whatsapp.dto.ScheduleBatchRequest;
import br.com.vilareal.whatsapp.dto.ScheduleBatchResponse;
import br.com.vilareal.whatsapp.dto.ScheduleBatchPreviewResponse;
import br.com.vilareal.whatsapp.dto.RecorrenciaAgendamentoRequest;
import br.com.vilareal.whatsapp.dto.RecorrenciaMensalRequest;
import br.com.vilareal.whatsapp.dto.SendMediaMessageResponse;
import br.com.vilareal.whatsapp.dto.SendMessageResponse;
import br.com.vilareal.whatsapp.dto.SendTemplateRequest;
import br.com.vilareal.whatsapp.dto.SendTextRequest;
import br.com.vilareal.whatsapp.dto.ScheduledMessageDTO;
import br.com.vilareal.whatsapp.dto.RecentConversationDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppIaHabilitadaDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppConversaGrupoItemDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppConversationDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppConversationSearchItemDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppMessageDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppMessageSearchResultDTO;
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
import br.com.vilareal.whatsapp.service.WhatsAppContactPhotoService;
import br.com.vilareal.whatsapp.service.WhatsAppConversationArchiveService;
import br.com.vilareal.whatsapp.service.WhatsAppConversaGrupoManualService;
import br.com.vilareal.whatsapp.service.WhatsAppConversationPinService;
import br.com.vilareal.whatsapp.service.WhatsAppConversationReadService;
import br.com.vilareal.whatsapp.service.WhatsAppConversationSearchService;
import br.com.vilareal.whatsapp.service.WhatsAppConversationWindowService;
import br.com.vilareal.whatsapp.service.WhatsAppIniciarConversaService;
import br.com.vilareal.whatsapp.service.WhatsAppConversationContextService;
import br.com.vilareal.whatsapp.service.WhatsAppConversationFeedService;
import br.com.vilareal.whatsapp.service.WhatsAppForwardMessageService;
import br.com.vilareal.whatsapp.service.WhatsAppMessageDeleteService;
import br.com.vilareal.whatsapp.service.WhatsAppNomeExibicaoService;
import br.com.vilareal.whatsapp.service.WhatsAppGrupoListService;
import br.com.vilareal.whatsapp.service.WhatsAppIAConfigService;
import br.com.vilareal.whatsapp.service.WhatsAppNotificationService;
import br.com.vilareal.whatsapp.service.WhatsAppTemplateService;
import br.com.vilareal.whatsapp.service.WhatsAppOutboundMediaService;
import br.com.vilareal.whatsapp.service.WhatsAppScheduleRecurrenceSupport;
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
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/whatsapp")
@Tag(name = "WhatsApp", description = "Envio, histórico, agendamentos e estatísticas WhatsApp Business")
public class WhatsAppController {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppController.class);
    private static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter DATA_HORA_PREVIEW =
            DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm").withZone(ZONE_BRASILIA);

    private final WhatsAppService whatsAppService;
    private final WhatsAppSchedulerService whatsAppSchedulerService;
    private final WhatsAppMessageRepository whatsAppMessageRepository;
    private final ScheduledWhatsAppMessageRepository scheduledWhatsAppMessageRepository;
    private final ObjectMapper objectMapper;
    private final WhatsAppConfig whatsAppConfig;
    private final WhatsAppTemplateService whatsAppTemplateService;
    private final WhatsAppNotificationService whatsAppNotificationService;
    private final WhatsAppAgendamentosFeedService agendamentosFeedService;
    private final WhatsAppIAConfigService whatsAppIAConfigService;
    private final WhatsAppConversationContextService conversationContextService;
    private final WhatsAppConversationFeedService conversationFeedService;
    private final WhatsAppMessageDeleteService messageDeleteService;
    private final WhatsAppOutboundMediaService outboundMediaService;
    private final WhatsAppConversationReadService conversationReadService;
    private final WhatsAppConversationPinService conversationPinService;
    private final WhatsAppConversationArchiveService conversationArchiveService;
    private final WhatsAppConversaGrupoManualService conversaGrupoManualService;
    private final WhatsAppIniciarConversaService iniciarConversaService;
    private final WhatsAppConversationWindowService conversationWindowService;
    private final WhatsAppNomeExibicaoService nomeExibicaoService;
    private final WhatsAppContactPhotoService contactPhotoService;
    private final WhatsAppConversationSearchService conversationSearchService;
    private final WhatsAppForwardMessageService forwardMessageService;

    public WhatsAppController(
            WhatsAppService whatsAppService,
            WhatsAppSchedulerService whatsAppSchedulerService,
            WhatsAppMessageRepository whatsAppMessageRepository,
            ScheduledWhatsAppMessageRepository scheduledWhatsAppMessageRepository,
            ObjectMapper objectMapper,
            WhatsAppConfig whatsAppConfig,
            WhatsAppTemplateService whatsAppTemplateService,
            WhatsAppNotificationService whatsAppNotificationService,
            WhatsAppAgendamentosFeedService agendamentosFeedService,
            WhatsAppIAConfigService whatsAppIAConfigService,
            WhatsAppConversationContextService conversationContextService,
            WhatsAppConversationFeedService conversationFeedService,
            WhatsAppMessageDeleteService messageDeleteService,
            WhatsAppOutboundMediaService outboundMediaService,
            WhatsAppConversationReadService conversationReadService,
            WhatsAppConversationPinService conversationPinService,
            WhatsAppConversationArchiveService conversationArchiveService,
            WhatsAppConversaGrupoManualService conversaGrupoManualService,
            WhatsAppIniciarConversaService iniciarConversaService,
            WhatsAppConversationWindowService conversationWindowService,
            WhatsAppNomeExibicaoService nomeExibicaoService,
            WhatsAppContactPhotoService contactPhotoService,
            WhatsAppConversationSearchService conversationSearchService,
            WhatsAppForwardMessageService forwardMessageService) {
        this.whatsAppService = whatsAppService;
        this.whatsAppSchedulerService = whatsAppSchedulerService;
        this.whatsAppMessageRepository = whatsAppMessageRepository;
        this.scheduledWhatsAppMessageRepository = scheduledWhatsAppMessageRepository;
        this.objectMapper = objectMapper;
        this.whatsAppConfig = whatsAppConfig;
        this.whatsAppTemplateService = whatsAppTemplateService;
        this.whatsAppNotificationService = whatsAppNotificationService;
        this.agendamentosFeedService = agendamentosFeedService;
        this.whatsAppIAConfigService = whatsAppIAConfigService;
        this.conversationContextService = conversationContextService;
        this.conversationFeedService = conversationFeedService;
        this.messageDeleteService = messageDeleteService;
        this.outboundMediaService = outboundMediaService;
        this.conversationReadService = conversationReadService;
        this.conversationPinService = conversationPinService;
        this.conversationArchiveService = conversationArchiveService;
        this.conversaGrupoManualService = conversaGrupoManualService;
        this.iniciarConversaService = iniciarConversaService;
        this.conversationWindowService = conversationWindowService;
        this.nomeExibicaoService = nomeExibicaoService;
        this.contactPhotoService = contactPhotoService;
        this.conversationSearchService = conversationSearchService;
        this.forwardMessageService = forwardMessageService;
    }

    @GetMapping("/iniciar/telefones")
    @Operation(summary = "Telefones canônicos de uma pessoa/cliente para iniciar conversa WhatsApp")
    public ResponseEntity<IniciarTelefonesResponseDTO> getTelefonesIniciarConversa(
            @RequestParam(required = false) Long pessoaId, @RequestParam(required = false) Long clienteId) {
        try {
            return ResponseEntity.ok(iniciarConversaService.resolverTelefones(pessoaId, clienteId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
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
            WhatsAppSendResponse response = whatsAppService.sendTextMessage(
                    request.phoneNumber(), request.message(), request.clienteId(), request.processoId());
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
                    request.phoneNumber(),
                    request.templateName(),
                    languageCode,
                    request.parameters(),
                    request.clienteId(),
                    request.processoId());
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
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "false") boolean arquivadas,
            @RequestParam(required = false) String clienteCodigo) {
        String codigoFiltro = WhatsAppGrupoListService.normalizarFiltroClienteCodigo(clienteCodigo);
        Page<ConversationSummaryRow> rows =
                whatsAppMessageRepository.findConversationSummariesExcluindoAniversario(
                        arquivadas, codigoFiltro, PageRequest.of(page, size));
        List<String> phones = rows.getContent().stream()
                .map(ConversationSummaryRow::getPhoneNumber)
                .toList();
        Map<String, List<WhatsAppProcessoContextItemDTO>> contextosPorTelefone =
                conversationContextService.resolverPorTelefones(phones);
        Map<String, String> nomesCadastro = nomeExibicaoService.resolverNomesPorTelefone(phones);
        Map<String, String> fotosPorTelefone = contactPhotoService.resolverUrlsPorTelefone(phones);
        return ResponseEntity.ok(rows.map(row -> toConversationDto(
                row, contextosPorTelefone.getOrDefault(row.getPhoneNumber(), List.of()), nomesCadastro, fotosPorTelefone)));
    }

    @GetMapping("/conversations/search")
    @Operation(summary = "Buscar conversas por nome (cadastro ou perfil WhatsApp) ou telefone parcial")
    public ResponseEntity<List<WhatsAppConversationSearchItemDTO>> searchConversations(
            @RequestParam(name = "q") String termo, @RequestParam(defaultValue = "20") int limit) {
        if (termo == null || termo.trim().length() < 2) {
            return ResponseEntity.ok(List.of());
        }
        return ResponseEntity.ok(conversationSearchService.buscar(termo, limit));
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

    @GetMapping("/conversations/{phoneNumber}/janela-aberta")
    @Operation(summary = "Verifica se a janela de 24h da Meta está aberta (INBOUND recente)")
    public ResponseEntity<JanelaAbertaResponseDTO> getJanelaAberta(@PathVariable String phoneNumber) {
        try {
            return ResponseEntity.ok(conversationWindowService.verificarJanelaAberta(phoneNumber));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
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

    @PostMapping("/conversations/marcar-lida-lote")
    @Operation(summary = "Marca várias conversas como lidas (telefones inválidos são pulados)")
    public ResponseEntity<WhatsAppMarcarLidasLoteResultDTO> marcarConversasLidasLote(
            @RequestBody WhatsAppMarcarLidasLoteRequest body) {
        List<String> phones = body != null && body.phones() != null ? body.phones() : List.of();
        return ResponseEntity.ok(conversationReadService.marcarComoLidaLote(phones));
    }

    @PostMapping("/conversations/{phoneNumber}/fixar")
    @Operation(summary = "Fixa conversa no topo da lista globalmente (estado interno do escritório)")
    public ResponseEntity<Void> fixarConversa(@PathVariable String phoneNumber) {
        try {
            conversationPinService.fixar(phoneNumber);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/conversations/fixar-lote")
    @Operation(summary = "Fixa várias conversas de uma vez (telefones inválidos são pulados)")
    public ResponseEntity<WhatsAppFixarConversasLoteResultDTO> fixarConversasLote(
            @RequestBody WhatsAppFixarConversasLoteRequest body) {
        List<String> phones = body != null && body.phones() != null ? body.phones() : List.of();
        return ResponseEntity.ok(conversationPinService.fixarLote(phones));
    }

    @DeleteMapping("/conversations/{phoneNumber}/fixar")
    @Operation(summary = "Remove fixação da conversa globalmente")
    public ResponseEntity<Void> desfixarConversa(@PathVariable String phoneNumber) {
        try {
            conversationPinService.desfixar(phoneNumber);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/conversations/arquivar-lote")
    @Operation(summary = "Arquiva várias conversas de uma vez (telefones inválidos são pulados)")
    public ResponseEntity<WhatsAppArquivarConversasLoteResultDTO> arquivarConversasLote(
            @RequestBody WhatsAppArquivarConversasLoteRequest body) {
        List<String> phones = body != null && body.phones() != null ? body.phones() : List.of();
        return ResponseEntity.ok(conversationArchiveService.arquivarLote(phones));
    }

    @PostMapping("/conversations/{phoneNumber}/arquivar")
    @Operation(summary = "Arquiva conversa globalmente (some da lista principal)")
    public ResponseEntity<Void> arquivarConversa(@PathVariable String phoneNumber) {
        try {
            conversationArchiveService.arquivar(phoneNumber);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/conversations/{phoneNumber}/arquivar")
    @Operation(summary = "Desarquiva conversa globalmente")
    public ResponseEntity<Void> desarquivarConversa(@PathVariable String phoneNumber) {
        try {
            conversationArchiveService.desarquivar(phoneNumber);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/conversations/{phoneNumber}/grupos")
    @Operation(summary = "Grupos (clientes) efetivos da conversa — auto ± manual")
    public ResponseEntity<List<WhatsAppConversaGrupoItemDTO>> listarGruposConversa(@PathVariable String phoneNumber) {
        try {
            return ResponseEntity.ok(conversaGrupoManualService.listarGrupos(phoneNumber));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/conversations/{phoneNumber}/grupos/{clienteCodigo}")
    @Operation(summary = "Incluir conversa manualmente em um grupo de cliente")
    public ResponseEntity<List<WhatsAppConversaGrupoItemDTO>> incluirGrupoConversa(
            @PathVariable String phoneNumber, @PathVariable String clienteCodigo) {
        try {
            return ResponseEntity.ok(conversaGrupoManualService.incluirManualmente(phoneNumber, clienteCodigo));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/conversations/{phoneNumber}/grupos/{clienteCodigo}")
    @Operation(summary = "Excluir conversa manualmente de um grupo de cliente")
    public ResponseEntity<List<WhatsAppConversaGrupoItemDTO>> excluirGrupoConversa(
            @PathVariable String phoneNumber, @PathVariable String clienteCodigo) {
        try {
            return ResponseEntity.ok(conversaGrupoManualService.excluirManualmente(phoneNumber, clienteCodigo));
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
        List<String> phones = rows.stream().map(RecentConversationRow::getPhoneNumber).toList();
        Map<String, String> nomesCadastro = nomeExibicaoService.resolverNomesPorTelefone(phones);
        Map<String, String> fotosPorTelefone = contactPhotoService.resolverUrlsPorTelefone(phones);
        return ResponseEntity.ok(
                rows.stream().map(row -> toRecentConversationDto(row, nomesCadastro, fotosPorTelefone)).toList());
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

    @GetMapping("/messages/search")
    @Operation(summary = "Buscar mensagens no histórico completo da conversa")
    public ResponseEntity<WhatsAppMessageSearchResultDTO> searchMessages(
            @RequestParam String phoneNumber, @RequestParam(name = "q") String termo) {
        try {
            return ResponseEntity.ok(conversationFeedService.buscarMensagens(phoneNumber, termo));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/messages/{messageId}/forward")
    @Operation(summary = "Encaminha mensagem ou mídia para outro(s) contato(s)")
    public ResponseEntity<?> encaminharMensagem(
            @PathVariable Long messageId, @Valid @RequestBody WhatsAppForwardMessageRequest request) {
        try {
            WhatsAppForwardMessageResponse response = forwardMessageService.encaminhar(
                    messageId, request.phoneNumbers(), request.caption());
            if (response.success()) {
                return ResponseEntity.ok(response);
            }
            return ResponseEntity.status(HttpStatus.MULTI_STATUS).body(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/messages/{messageId}")
    @Operation(summary = "Apaga mensagem — inbox (soft delete) ou para todos (revoga outbound no WhatsApp)")
    public ResponseEntity<?> apagarMensagem(
            @PathVariable Long messageId,
            @RequestParam(defaultValue = "inbox") String escopo) {
        try {
            if ("todos".equalsIgnoreCase(escopo)) {
                messageDeleteService.apagarMensagemParaTodos(messageId);
            } else {
                messageDeleteService.apagarMensagem(messageId);
            }
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (WhatsAppApiException e) {
            return ResponseEntity.status(mapWhatsAppHttpStatus(e))
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/conversations/{phoneNumber}")
    @Operation(summary = "Apaga conversa inteira da inbox do sistema (soft delete das mensagens)")
    public ResponseEntity<WhatsAppApagarConversaResultDTO> apagarConversa(@PathVariable String phoneNumber) {
        try {
            return ResponseEntity.ok(messageDeleteService.apagarConversa(phoneNumber));
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

    @PostMapping("/agendamentos/lote")
    @Operation(summary = "Criar vários agendamentos idênticos (template + params) em datas distintas")
    public ResponseEntity<ScheduleBatchResponse> scheduleBatch(@Valid @RequestBody ScheduleBatchRequest request) {
        try {
            List<Instant> datas = whatsAppSchedulerService.resolverDatasAgendamentoLote(
                    request.scheduledAtList(), request.recorrencia(), request.recorrenciaMensal());
            var result = whatsAppSchedulerService.agendarMensagensEmLote(
                    request.phoneNumber(),
                    request.templateName(),
                    request.parameters(),
                    datas,
                    request.clienteId(),
                    request.processoId(),
                    resolveCreatedBy(),
                    request.descricao());
            String msg = result.pulados() > 0
                    ? "%d agendamento(s) criado(s); %d ignorado(s) (duplicado ou data passada)"
                            .formatted(result.criados(), result.pulados())
                    : "%d agendamento(s) criado(s)".formatted(result.criados());
            return ResponseEntity.ok(new ScheduleBatchResponse(
                    result.criados(),
                    result.pulados(),
                    result.totalSolicitado(),
                    result.ids(),
                    result.scheduledAt(),
                    msg));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(new ScheduleBatchResponse(0, 0, 0, List.of(), List.of(), e.getMessage()));
        }
    }

    @PostMapping("/agendamentos/lote/preview")
    @Operation(summary = "Preview das datas de um lote (recorrência mensal ou lista avulsa)")
    public ResponseEntity<ScheduleBatchPreviewResponse> scheduleBatchPreview(
            @Valid @RequestBody ScheduleBatchRequest request) {
        try {
            List<Instant> datas = whatsAppSchedulerService.resolverDatasAgendamentoLote(
                    request.scheduledAtList(), request.recorrencia(), request.recorrenciaMensal());
            List<String> labels = new ArrayList<>(datas.size());
            for (Instant instant : datas) {
                labels.add(DATA_HORA_PREVIEW.format(instant));
            }
            return ResponseEntity.ok(new ScheduleBatchPreviewResponse(datas.size(), datas, labels));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/agendamentos/lote/preview-recorrencia")
    @Operation(summary = "Preview de recorrência (mensal, semanal ou intervalo no dia)")
    public ResponseEntity<ScheduleBatchPreviewResponse> scheduleRecurrencePreview(
            @Valid @RequestBody RecorrenciaAgendamentoRequest request) {
        try {
            List<Instant> datas = WhatsAppScheduleRecurrenceSupport.resolver(request);
            return ResponseEntity.ok(previewResponse(datas));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/agendamentos/lote/preview-recorrencia-mensal")
    @Operation(summary = "Preview da recorrência mensal legada (intervalo de meses)")
    public ResponseEntity<ScheduleBatchPreviewResponse> scheduleRecurrenceMensalPreview(
            @Valid @RequestBody RecorrenciaMensalRequest request) {
        try {
            List<Instant> datas = WhatsAppScheduleRecurrenceSupport.resolverLegadoMensal(request);
            return ResponseEntity.ok(previewResponse(datas));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    private static ScheduleBatchPreviewResponse previewResponse(List<Instant> datas) {
        List<String> labels = new ArrayList<>(datas.size());
        for (Instant instant : datas) {
            labels.add(DATA_HORA_PREVIEW.format(instant));
        }
        return new ScheduleBatchPreviewResponse(datas.size(), datas, labels);
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
    public ResponseEntity<?> createTemplate(@Valid @RequestBody CreateTemplateRequest request) {
        try {
            WhatsAppTemplateDTO created = whatsAppTemplateService.criarTemplate(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
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
            ConversationSummaryRow row,
            List<WhatsAppProcessoContextItemDTO> contextos,
            Map<String, String> nomesCadastro,
            Map<String, String> fotosPorTelefone) {
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
                nomeExibicaoService.resolverNomeExibido(
                        row.getPhoneNumber(), row.getContactName(), nomesCadastro),
                preview,
                row.getLastMessageDirection(),
                row.getLastMessageType(),
                row.getLastMessageAt(),
                unreadCountOf(row.getUnreadCount()),
                pinnedOf(row.getPinned()),
                principal,
                safeContextos,
                contactPhotoUrlOf(row.getPhoneNumber(), fotosPorTelefone));
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
                case "REACTION" -> WhatsAppReactionSupport.resumoLegivel(row.getLastMessageContent());
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

    private RecentConversationDTO toRecentConversationDto(
            RecentConversationRow row, Map<String, String> nomesCadastro, Map<String, String> fotosPorTelefone) {
        String preview = previewFromRecentRow(row);
        if (StringUtils.hasText(preview) && preview.length() > 120) {
            preview = preview.substring(0, 117) + "...";
        }
        return new RecentConversationDTO(
                row.getPhoneNumber(),
                WhatsAppService.formatPhoneDisplay(row.getPhoneNumber()),
                nomeExibicaoService.resolverNomeExibido(
                        row.getPhoneNumber(), row.getContactName(), nomesCadastro),
                preview,
                row.getLastMessageType(),
                row.getLastMessageAt(),
                row.getTotalMessages() != null ? row.getTotalMessages() : 0L,
                unreadCountOf(row.getUnreadCount()),
                pinnedOf(row.getPinned()),
                contactPhotoUrlOf(row.getPhoneNumber(), fotosPorTelefone));
    }

    private static String contactPhotoUrlOf(String phoneNumber, Map<String, String> fotosPorTelefone) {
        if (phoneNumber == null || fotosPorTelefone == null || fotosPorTelefone.isEmpty()) {
            return null;
        }
        return fotosPorTelefone.get(phoneNumber);
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
                case "REACTION" -> WhatsAppReactionSupport.resumoLegivel(row.getLastMessageContent());
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

    private static boolean pinnedOf(Integer pinned) {
        return pinned != null && pinned > 0;
    }

    private WhatsAppMessageDTO toMessageDto(WhatsAppMessageEntity entity) {
        return WhatsAppMessageDtoMapper.fromEntity(
                entity,
                nomeExibicaoService.resolverNomeExibido(entity.getPhoneNumber(), entity.getContactName()));
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
