package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.dto.WhatsAppMarcarLidasLoteResultDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationReadRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;

@Service
public class WhatsAppConversationReadService {

    private final WhatsAppConversationReadRepository readRepository;
    private final WhatsAppMessageRepository messageRepository;
    private final WhatsAppNotificationService whatsAppNotificationService;

    public WhatsAppConversationReadService(
            WhatsAppConversationReadRepository readRepository,
            WhatsAppMessageRepository messageRepository,
            WhatsAppNotificationService whatsAppNotificationService) {
        this.readRepository = readRepository;
        this.messageRepository = messageRepository;
        this.whatsAppNotificationService = whatsAppNotificationService;
    }

    /**
     * Marca a conversa como lida globalmente (qualquer atendente). Idempotente.
     * Usa o mesmo formato canônico de {@code whatsapp_messages.phone_number} (55 + DDD + número).
     */
    @Transactional
    public void marcarComoLida(String phoneNumber) {
        String normalized = WhatsAppService.formatPhoneNumber(phoneNumber);
        Instant now = Instant.now();
        readRepository.upsertLastReadAt(normalized, now);
        whatsAppNotificationService.notifyConversationRead(normalized, now);
    }

    @Transactional
    public WhatsAppMarcarLidasLoteResultDTO marcarComoLidaLote(List<String> phones) {
        if (phones == null || phones.isEmpty()) {
            return new WhatsAppMarcarLidasLoteResultDTO(0, 0);
        }
        int marcados = 0;
        int pulados = 0;
        for (String phone : phones) {
            if (!StringUtils.hasText(phone)) {
                pulados++;
                continue;
            }
            try {
                marcarComoLida(phone);
                marcados++;
            } catch (IllegalArgumentException e) {
                pulados++;
            }
        }
        return new WhatsAppMarcarLidasLoteResultDTO(marcados, pulados);
    }

    @Transactional(readOnly = true)
    public long contarConversasNaoLidas() {
        Long total = messageRepository.countConversasComInboundNaoLido();
        return total != null ? total : 0L;
    }
}
