package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import br.com.vilareal.whatsapp.WhatsAppMessageStatus;
import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface WhatsAppMessageRepository extends JpaRepository<WhatsAppMessageEntity, Long> {

    interface ConversationSummaryRow {
        String getPhoneNumber();

        String getContactName();

        String getLastMessageDirection();

        String getLastMessageContent();

        Instant getLastMessageAt();
    }

    @Query(
            value =
                    """
                    SELECT w.phone_number AS phoneNumber,
                           (
                               SELECT w2.contact_name
                               FROM whatsapp_messages w2
                               WHERE w2.phone_number = w.phone_number
                                 AND w2.contact_name IS NOT NULL
                                 AND TRIM(w2.contact_name) <> ''
                               ORDER BY w2.created_at DESC
                               LIMIT 1
                           ) AS contactName,
                           (
                               SELECT w3.direction
                               FROM whatsapp_messages w3
                               WHERE w3.phone_number = w.phone_number
                               ORDER BY w3.created_at DESC
                               LIMIT 1
                           ) AS lastMessageDirection,
                           (
                               SELECT w4.content
                               FROM whatsapp_messages w4
                               WHERE w4.phone_number = w.phone_number
                               ORDER BY w4.created_at DESC
                               LIMIT 1
                           ) AS lastMessageContent,
                           MAX(w.created_at) AS lastMessageAt
                    FROM whatsapp_messages w
                    GROUP BY w.phone_number
                    ORDER BY lastMessageAt DESC
                    """,
            countQuery = "SELECT COUNT(DISTINCT w.phone_number) FROM whatsapp_messages w",
            nativeQuery = true)
    Page<ConversationSummaryRow> findConversationSummaries(Pageable pageable);

    Page<WhatsAppMessageEntity> findByPhoneNumberOrderByCreatedAtDesc(String phoneNumber, Pageable pageable);

    List<WhatsAppMessageEntity> findByPhoneNumberAndCreatedAtAfterOrderByCreatedAtAsc(
            String phoneNumber, Instant after);

    Optional<WhatsAppMessageEntity> findByWaMessageId(String waMessageId);

    Page<WhatsAppMessageEntity> findByClienteIdOrderByCreatedAtDesc(Long clienteId, Pageable pageable);

    long countByDirectionAndCreatedAtAfter(WhatsAppMessageDirection direction, Instant after);

    long countByStatusAndCreatedAtAfter(WhatsAppMessageStatus status, Instant after);
}
