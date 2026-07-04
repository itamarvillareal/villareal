package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationReadRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

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

    @Transactional(readOnly = true)
    public long contarConversasNaoLidas() {
        Long total = messageRepository.countConversasComInboundNaoLido();
        return total != null ? total : 0L;
    }
}
