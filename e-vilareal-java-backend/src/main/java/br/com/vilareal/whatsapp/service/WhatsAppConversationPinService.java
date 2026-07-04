package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationPinRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class WhatsAppConversationPinService {

    private final WhatsAppConversationPinRepository pinRepository;

    public WhatsAppConversationPinService(WhatsAppConversationPinRepository pinRepository) {
        this.pinRepository = pinRepository;
    }

    /** Fixa conversa globalmente. Idempotente (atualiza pinned_at se já fixada). */
    @Transactional
    public void fixar(String phoneNumber) {
        String normalized = WhatsAppService.formatPhoneNumber(phoneNumber);
        pinRepository.upsertPinnedAt(normalized, Instant.now());
    }

    /** Remove fixação. Idempotente se já desfixada. */
    @Transactional
    public void desfixar(String phoneNumber) {
        String normalized = WhatsAppService.formatPhoneNumber(phoneNumber);
        pinRepository.deleteByPhoneNumber(normalized);
    }
}
