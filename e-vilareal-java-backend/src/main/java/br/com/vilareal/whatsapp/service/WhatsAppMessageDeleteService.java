package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.dto.WhatsAppApagarConversaResultDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationArchiveRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationPinRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationReadRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversaClienteManualRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

@Service
public class WhatsAppMessageDeleteService {

    private final WhatsAppMessageRepository messageRepository;
    private final WhatsAppConversationPinRepository pinRepository;
    private final WhatsAppConversationArchiveRepository archiveRepository;
    private final WhatsAppConversationReadRepository readRepository;
    private final WhatsAppConversaClienteManualRepository manualRepository;
    private final WhatsAppService whatsAppService;

    public WhatsAppMessageDeleteService(
            WhatsAppMessageRepository messageRepository,
            WhatsAppConversationPinRepository pinRepository,
            WhatsAppConversationArchiveRepository archiveRepository,
            WhatsAppConversationReadRepository readRepository,
            WhatsAppConversaClienteManualRepository manualRepository,
            WhatsAppService whatsAppService) {
        this.messageRepository = messageRepository;
        this.pinRepository = pinRepository;
        this.archiveRepository = archiveRepository;
        this.readRepository = readRepository;
        this.manualRepository = manualRepository;
        this.whatsAppService = whatsAppService;
    }

    /** Soft delete idempotente — a linha permanece com deleted_at preenchido. */
    @Transactional
    public void apagarMensagem(Long messageId) {
        if (messageId == null || messageId <= 0) {
            throw new IllegalArgumentException("ID de mensagem inválido");
        }
        messageRepository.softDeleteById(messageId, Instant.now());
    }

    /**
     * Revoga mensagem outbound no WhatsApp do contato e remove do histórico do sistema.
     * Disponível apenas para mensagens enviadas pelo escritório, com wamid, dentro de 48 horas.
     */
    @Transactional
    public void apagarMensagemParaTodos(Long messageId) {
        WhatsAppMessageEntity message = carregarMensagemAtiva(messageId);
        validarRevogacaoOutbound(message);
        whatsAppService.revokeOutboundMessage(message.getWaMessageId(), message.getPhoneNumber());
        messageRepository.softDeleteById(messageId, Instant.now());
    }

    private WhatsAppMessageEntity carregarMensagemAtiva(Long messageId) {
        if (messageId == null || messageId <= 0) {
            throw new IllegalArgumentException("ID de mensagem inválido");
        }
        Optional<WhatsAppMessageEntity> optional = messageRepository.findById(messageId);
        if (optional.isEmpty() || optional.get().getDeletedAt() != null) {
            throw new IllegalArgumentException("Mensagem não encontrada");
        }
        return optional.get();
    }

    private static void validarRevogacaoOutbound(WhatsAppMessageEntity message) {
        if (message.getDirection() != WhatsAppMessageDirection.OUTBOUND) {
            throw new IllegalArgumentException(
                    "Só é possível apagar para todos mensagens enviadas pelo escritório.");
        }
        if (!StringUtils.hasText(message.getWaMessageId())) {
            throw new IllegalArgumentException("Mensagem sem ID do WhatsApp — não é possível revogar.");
        }
        Instant limite =
                Instant.now().minus(WhatsAppService.JANELA_REVOGACAO_OUTBOUND_HORAS, ChronoUnit.HOURS);
        if (message.getCreatedAt() == null || message.getCreatedAt().isBefore(limite)) {
            throw new IllegalArgumentException(
                    "Prazo de 48 horas para apagar no WhatsApp do contato já expirou.");
        }
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
