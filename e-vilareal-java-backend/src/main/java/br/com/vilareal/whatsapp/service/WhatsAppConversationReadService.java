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

    public WhatsAppConversationReadService(
            WhatsAppConversationReadRepository readRepository, WhatsAppMessageRepository messageRepository) {
        this.readRepository = readRepository;
        this.messageRepository = messageRepository;
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
        // Passo 3 (front/SSE): whatsAppNotificationService.emitConversationRead(normalized, now);
    }

    @Transactional(readOnly = true)
    public long contarConversasNaoLidas() {
        Long total = messageRepository.countConversasComInboundNaoLido();
        return total != null ? total : 0L;
    }
}
