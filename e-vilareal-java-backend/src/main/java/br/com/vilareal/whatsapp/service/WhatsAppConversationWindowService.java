package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.dto.JanelaAbertaResponseDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

@Service
public class WhatsAppConversationWindowService {

    private static final int JANELA_HORAS = 24;

    private final WhatsAppMessageRepository messageRepository;

    public WhatsAppConversationWindowService(WhatsAppMessageRepository messageRepository) {
        this.messageRepository = messageRepository;
    }

    /**
     * Janela de 24h da Meta: aberta se houve INBOUND recente para o telefone.
     * Usa a mesma tolerância de sufixo do feed ({@code RIGHT(11)} / {@code RIGHT(10)}).
     */
    @Transactional(readOnly = true)
    public JanelaAbertaResponseDTO verificarJanelaAberta(String phoneNumber) {
        String normalized = WhatsAppService.formatPhoneNumber(phoneNumber);
        String suffix = WhatsAppConversationContextService.sufixo11(normalized);
        if (!StringUtils.hasText(suffix)) {
            return new JanelaAbertaResponseDTO(false, null);
        }

        Instant since = Instant.now().minus(JANELA_HORAS, ChronoUnit.HOURS);
        Optional<WhatsAppMessageEntity> ultima = messageRepository.findLatestInboundByPhoneSuffixSince(suffix, since);
        if (ultima.isEmpty()) {
            return new JanelaAbertaResponseDTO(false, null);
        }
        Instant quando = ultima.get().getCreatedAt();
        return new JanelaAbertaResponseDTO(true, quando);
    }
}
