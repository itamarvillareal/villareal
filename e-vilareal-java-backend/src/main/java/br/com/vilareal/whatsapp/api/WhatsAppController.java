package br.com.vilareal.whatsapp.api;

import br.com.vilareal.whatsapp.ScheduledMessageStatus;
import br.com.vilareal.whatsapp.WhatsAppApiException;
import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.WhatsAppMessageStatus;
import br.com.vilareal.whatsapp.dto.ScheduleMessageRequest;
import br.com.vilareal.whatsapp.dto.ScheduleMessageResponse;
import br.com.vilareal.whatsapp.dto.SendMessageResponse;
import br.com.vilareal.whatsapp.dto.SendTemplateRequest;
import br.com.vilareal.whatsapp.dto.SendTextRequest;
import br.com.vilareal.whatsapp.dto.ScheduledMessageDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppMessageDTO;
import br.com.vilareal.whatsapp.dto.WhatsAppSendResponse;
import br.com.vilareal.whatsapp.dto.WhatsAppStatsDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.ScheduledWhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.ScheduledWhatsAppMessageRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
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
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;

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

    public WhatsAppController(
            WhatsAppService whatsAppService,
            WhatsAppSchedulerService whatsAppSchedulerService,
            WhatsAppMessageRepository whatsAppMessageRepository,
            ScheduledWhatsAppMessageRepository scheduledWhatsAppMessageRepository,
            ObjectMapper objectMapper) {
        this.whatsAppService = whatsAppService;
        this.whatsAppSchedulerService = whatsAppSchedulerService;
        this.whatsAppMessageRepository = whatsAppMessageRepository;
        this.scheduledWhatsAppMessageRepository = scheduledWhatsAppMessageRepository;
        this.objectMapper = objectMapper;
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

    @GetMapping("/messages")
    @Operation(summary = "Listar mensagens por telefone")
    public ResponseEntity<Page<WhatsAppMessageDTO>> getMessages(
            @RequestParam String phoneNumber,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            String normalizedPhone = WhatsAppService.formatPhoneNumber(phoneNumber);
            Page<WhatsAppMessageEntity> messages = whatsAppMessageRepository.findByPhoneNumberOrderByCreatedAtDesc(
                    normalizedPhone, PageRequest.of(page, size));
            return ResponseEntity.ok(messages.map(this::toMessageDto));
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
    @Operation(summary = "Listar agendamentos de mensagens")
    public ResponseEntity<Page<ScheduledMessageDTO>> getScheduled(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<ScheduledWhatsAppMessageEntity> scheduled;
        if (StringUtils.hasText(status)) {
            try {
                ScheduledMessageStatus statusEnum =
                        ScheduledMessageStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
                scheduled = scheduledWhatsAppMessageRepository.findByStatusOrderByScheduledAtAsc(
                        statusEnum, PageRequest.of(page, size));
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().build();
            }
        } else {
            scheduled = scheduledWhatsAppMessageRepository.findAllByOrderByScheduledAtDesc(PageRequest.of(page, size));
        }
        return ResponseEntity.ok(scheduled.map(this::toScheduledDto));
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
        long scheduledPending =
                scheduledWhatsAppMessageRepository.countByStatus(ScheduledMessageStatus.PENDING);
        long failedToday = whatsAppMessageRepository.countByStatusAndCreatedAtAfter(
                WhatsAppMessageStatus.FAILED, startOfToday);

        return ResponseEntity.ok(new WhatsAppStatsDTO(sentToday, receivedToday, scheduledPending, failedToday));
    }

    private WhatsAppMessageDTO toMessageDto(WhatsAppMessageEntity entity) {
        return new WhatsAppMessageDTO(
                entity.getId(),
                entity.getWaMessageId(),
                entity.getPhoneNumber(),
                entity.getContactName(),
                entity.getDirection() != null ? entity.getDirection().name() : null,
                entity.getMessageType() != null ? entity.getMessageType().name() : null,
                entity.getContent(),
                entity.getTemplateName(),
                entity.getStatus() != null ? entity.getStatus().name() : null,
                entity.getClienteId(),
                entity.getProcessoId(),
                entity.getCreatedAt());
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
