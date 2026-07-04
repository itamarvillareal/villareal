package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversationArchiveRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;

@Service
public class WhatsAppConversationArchiveService {

    private final WhatsAppConversationArchiveRepository archiveRepository;

    public WhatsAppConversationArchiveService(WhatsAppConversationArchiveRepository archiveRepository) {
        this.archiveRepository = archiveRepository;
    }

    @Transactional
    public void arquivar(String phoneNumber) {
        String normalized = WhatsAppService.formatPhoneNumber(phoneNumber);
        archiveRepository.upsertArchivedAt(normalized, Instant.now());
    }

    @Transactional
    public void desarquivar(String phoneNumber) {
        String normalized = WhatsAppService.formatPhoneNumber(phoneNumber);
        archiveRepository.deleteByPhoneNumber(normalized);
    }

    @Transactional(readOnly = true)
    public boolean existePorTelefone(String phoneNumber) {
        return archiveRepository.existsById(normalizarSeguro(phoneNumber));
    }

    /** Desarquiva se existir (INBOUND). Idempotente. Usa telefone já canônico ou fallback original. */
    @Transactional
    public void desarquivarSeExistir(String phoneNumber) {
        if (!StringUtils.hasText(phoneNumber)) {
            return;
        }
        String key = normalizarSeguro(phoneNumber);
        if (archiveRepository.existsById(key)) {
            archiveRepository.deleteByPhoneNumber(key);
        }
    }

    private static String normalizarSeguro(String phoneNumber) {
        try {
            return WhatsAppService.formatPhoneNumber(phoneNumber);
        } catch (IllegalArgumentException e) {
            return phoneNumber.trim();
        }
    }
}
