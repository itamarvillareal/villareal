package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface WhatsAppMessageRepository extends JpaRepository<WhatsAppMessageEntity, Long> {

    Page<WhatsAppMessageEntity> findByPhoneNumberOrderByCreatedAtDesc(String phoneNumber, Pageable pageable);

    List<WhatsAppMessageEntity> findByPhoneNumberAndCreatedAtAfterOrderByCreatedAtAsc(
            String phoneNumber, Instant after);

    Optional<WhatsAppMessageEntity> findByWaMessageId(String waMessageId);

    Page<WhatsAppMessageEntity> findByClienteIdOrderByCreatedAtDesc(Long clienteId, Pageable pageable);

    long countByDirectionAndCreatedAtAfter(WhatsAppMessageDirection direction, Instant after);
}
