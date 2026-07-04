package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.dto.WhatsAppFixarConversasLoteResultDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationPinRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;

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

    @Transactional
    public WhatsAppFixarConversasLoteResultDTO fixarLote(List<String> phones) {
        if (phones == null || phones.isEmpty()) {
            return new WhatsAppFixarConversasLoteResultDTO(0, 0);
        }
        int fixados = 0;
        int pulados = 0;
        for (String phone : phones) {
            if (!StringUtils.hasText(phone)) {
                pulados++;
                continue;
            }
            try {
                fixar(phone);
                fixados++;
            } catch (IllegalArgumentException e) {
                pulados++;
            }
        }
        return new WhatsAppFixarConversasLoteResultDTO(fixados, pulados);
    }

    /** Remove fixação. Idempotente se já desfixada. */
    @Transactional
    public void desfixar(String phoneNumber) {
        String normalized = WhatsAppService.formatPhoneNumber(phoneNumber);
        pinRepository.deleteByPhoneNumber(normalized);
    }
}
