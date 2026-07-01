package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.ScheduledMessageStatus;
import br.com.vilareal.whatsapp.dto.ScheduledMessageDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.CobrancaWhatsAppEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.ScheduledWhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.CobrancaWhatsAppRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.ScheduledWhatsAppMessageRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Feed unificado de agendamentos WhatsApp: {@code scheduled_whatsapp_messages} + cobranças
 * ({@code whatsapp_cobrancas} com {@code scheduled_at}).
 */
@Service
public class WhatsAppAgendamentosFeedService {

    private static final String SOURCE_MESSAGE = "MESSAGE";
    private static final String SOURCE_COBRANCA = "COBRANCA";

    private final ScheduledWhatsAppMessageRepository scheduledRepository;
    private final CobrancaWhatsAppRepository cobrancaRepository;
    private final ObjectMapper objectMapper;

    public WhatsAppAgendamentosFeedService(
            ScheduledWhatsAppMessageRepository scheduledRepository,
            CobrancaWhatsAppRepository cobrancaRepository,
            ObjectMapper objectMapper) {
        this.scheduledRepository = scheduledRepository;
        this.cobrancaRepository = cobrancaRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public Page<ScheduledMessageDTO> listar(String status, Pageable pageable) {
        List<ScheduledMessageDTO> merged = new ArrayList<>();
        merged.addAll(listarMensagens(status));
        merged.addAll(listarCobrancas(status));

        boolean ascending = StringUtils.hasText(status)
                && ScheduledMessageStatus.PENDING.name().equalsIgnoreCase(status.trim());
        Comparator<ScheduledMessageDTO> cmp = Comparator.comparing(
                ScheduledMessageDTO::scheduledAt,
                Comparator.nullsLast(Comparator.naturalOrder()));
        if (!ascending) {
            cmp = cmp.reversed();
        }
        merged.sort(cmp);

        int start = (int) pageable.getOffset();
        if (start >= merged.size()) {
            return new PageImpl<>(List.of(), pageable, merged.size());
        }
        int end = Math.min(start + pageable.getPageSize(), merged.size());
        return new PageImpl<>(merged.subList(start, end), pageable, merged.size());
    }

    public long contarPendentes() {
        long msg = scheduledRepository.countByStatus(ScheduledMessageStatus.PENDING);
        long cob = cobrancaRepository.countByStatus("AGENDADO");
        return msg + cob;
    }

    private List<ScheduledMessageDTO> listarMensagens(String status) {
        if (!StringUtils.hasText(status)) {
            return scheduledRepository.findAllByOrderByScheduledAtDesc(Pageable.unpaged()).stream()
                    .map(this::toDtoMensagem)
                    .toList();
        }
        try {
            ScheduledMessageStatus statusEnum =
                    ScheduledMessageStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
            return scheduledRepository
                    .findByStatusOrderByScheduledAtAsc(statusEnum, Pageable.unpaged())
                    .stream()
                    .map(this::toDtoMensagem)
                    .toList();
        } catch (IllegalArgumentException e) {
            return List.of();
        }
    }

    private List<ScheduledMessageDTO> listarCobrancas(String status) {
        List<String> statuses = mapStatusFiltroCobranca(status);
        if (statuses.isEmpty()) {
            return List.of();
        }
        return cobrancaRepository.findByStatusInAndScheduledAtIsNotNullOrderByScheduledAtDesc(statuses).stream()
                .map(this::toDtoCobranca)
                .toList();
    }

    private static List<String> mapStatusFiltroCobranca(String status) {
        if (!StringUtils.hasText(status)) {
            return List.of("AGENDADO", "ENVIADO", "ENTREGUE", "LIDO", "FALHOU", "CANCELADO", "PENDENTE");
        }
        return switch (status.trim().toUpperCase(Locale.ROOT)) {
            case "PENDING" -> List.of("AGENDADO");
            case "SENT" -> List.of("ENVIADO", "ENTREGUE", "LIDO");
            case "FAILED" -> List.of("FALHOU");
            case "CANCELLED" -> List.of("CANCELADO");
            default -> List.of();
        };
    }

    private ScheduledMessageDTO toDtoMensagem(ScheduledWhatsAppMessageEntity e) {
        return new ScheduledMessageDTO(
                e.getId(),
                e.getPhoneNumber(),
                e.getTemplateName(),
                parseParams(e.getTemplateParams()),
                e.getScheduledAt(),
                e.getStatus() != null ? e.getStatus().name() : ScheduledMessageStatus.PENDING.name(),
                e.getSentAt(),
                e.getErrorMessage(),
                e.getRetryCount(),
                e.getClienteId(),
                e.getProcessoId(),
                e.getCreatedBy(),
                e.getDescricao(),
                e.getCreatedAt(),
                SOURCE_MESSAGE);
    }

    private ScheduledMessageDTO toDtoCobranca(CobrancaWhatsAppEntity c) {
        List<String> params = List.of(
                extrairPrimeiroNome(c.getPessoaNome()),
                StringUtils.hasText(c.getUnidadeDescricao()) ? c.getUnidadeDescricao().trim() : "Unidade",
                StringUtils.hasText(c.getCondominioNome()) ? c.getCondominioNome().trim() : "Condomínio");
        return new ScheduledMessageDTO(
                c.getId(),
                c.getPhoneNumber(),
                CobrancaWhatsAppService.TEMPLATE_COBRANCA,
                params,
                c.getScheduledAt(),
                mapStatusCobranca(c.getStatus()),
                c.getEnviadoAt(),
                c.getErrorMessage(),
                0,
                c.getClienteId(),
                c.getProcessoId(),
                c.getCreatedBy(),
                c.getLoteDescricao(),
                c.getCreatedAt(),
                SOURCE_COBRANCA);
    }

    private static String mapStatusCobranca(String status) {
        if (!StringUtils.hasText(status)) {
            return ScheduledMessageStatus.PENDING.name();
        }
        return switch (status.trim().toUpperCase(Locale.ROOT)) {
            case "AGENDADO" -> ScheduledMessageStatus.PENDING.name();
            case "ENVIADO", "ENTREGUE", "LIDO" -> ScheduledMessageStatus.SENT.name();
            case "FALHOU" -> ScheduledMessageStatus.FAILED.name();
            case "CANCELADO" -> ScheduledMessageStatus.CANCELLED.name();
            default -> status.toUpperCase(Locale.ROOT);
        };
    }

    private static String extrairPrimeiroNome(String nome) {
        if (!StringUtils.hasText(nome)) {
            return "Cliente";
        }
        String trimmed = nome.trim();
        int sp = trimmed.indexOf(' ');
        return sp > 0 ? trimmed.substring(0, sp) : trimmed;
    }

    private List<String> parseParams(String json) {
        if (!StringUtils.hasText(json)) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of();
        }
    }
}
