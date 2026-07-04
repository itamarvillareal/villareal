package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.dto.WhatsAppApagarConversaResultDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationArchiveRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationPinRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationReadRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversaClienteManualRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;

@Service
public class WhatsAppMessageDeleteService {

    private final WhatsAppMessageRepository messageRepository;
    private final WhatsAppConversationPinRepository pinRepository;
    private final WhatsAppConversationArchiveRepository archiveRepository;
    private final WhatsAppConversationReadRepository readRepository;
    private final WhatsAppConversaClienteManualRepository manualRepository;

    public WhatsAppMessageDeleteService(
            WhatsAppMessageRepository messageRepository,
            WhatsAppConversationPinRepository pinRepository,
            WhatsAppConversationArchiveRepository archiveRepository,
            WhatsAppConversationReadRepository readRepository,
            WhatsAppConversaClienteManualRepository manualRepository) {
        this.messageRepository = messageRepository;
        this.pinRepository = pinRepository;
        this.archiveRepository = archiveRepository;
        this.readRepository = readRepository;
        this.manualRepository = manualRepository;
    }

    /** Soft delete idempotente — a linha permanece com deleted_at preenchido. */
    @Transactional
    public void apagarMensagem(Long messageId) {
        if (messageId == null || messageId <= 0) {
            throw new IllegalArgumentException("ID de mensagem inválido");
        }
        messageRepository.softDeleteById(messageId, Instant.now());
    }

    @Transactional
    public WhatsAppApagarConversaResultDTO apagarConversa(String phoneNumber) {
        String normalized = WhatsAppService.formatPhoneNumber(phoneNumber);
        String suffix = WhatsAppConversationContextService.sufixo11(normalized);
        if (!StringUtils.hasText(suffix)) {
            throw new IllegalArgumentException("Telefone inválido");
        }
        int afetadas = messageRepository.softDeleteByPhoneSuffix(suffix, Instant.now());
        limparEstadoConversa(normalized);
        return new WhatsAppApagarConversaResultDTO(afetadas);
    }

    private void limparEstadoConversa(String phoneNumber) {
        pinRepository.deleteByPhoneNumber(phoneNumber);
        archiveRepository.deleteByPhoneNumber(phoneNumber);
        readRepository.deleteByPhoneNumber(phoneNumber);
        manualRepository.deleteByPhoneNumber(phoneNumber);
    }
}
