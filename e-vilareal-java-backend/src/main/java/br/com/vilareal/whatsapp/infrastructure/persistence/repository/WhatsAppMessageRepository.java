package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import br.com.vilareal.whatsapp.WhatsAppMediaStatus;
import br.com.vilareal.whatsapp.WhatsAppMessageDirection;
import br.com.vilareal.whatsapp.WhatsAppMessageStatus;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface WhatsAppMessageRepository extends JpaRepository<WhatsAppMessageEntity, Long> {

    interface ConversationSummaryRow {
        String getPhoneNumber();

        String getContactName();

        String getLastMessageDirection();

        String getLastMessageContent();

        String getLastMessageType();

        Instant getLastMessageAt();

        Long getUnreadCount();
    }

    interface RecentConversationRow {
        String getPhoneNumber();

        String getContactName();

        String getLastMessageContent();

        String getLastMessageType();

        Instant getLastMessageAt();

        Long getTotalMessages();

        Long getUnreadCount();
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
                           (
                               SELECT w5.message_type
                               FROM whatsapp_messages w5
                               WHERE w5.phone_number = w.phone_number
                               ORDER BY w5.created_at DESC
                               LIMIT 1
                           ) AS lastMessageType,
                           MAX(w.created_at) AS lastMessageAt
                    FROM whatsapp_messages w
                    GROUP BY w.phone_number
                    ORDER BY lastMessageAt DESC
                    """,
            countQuery = "SELECT COUNT(DISTINCT w.phone_number) FROM whatsapp_messages w",
            nativeQuery = true)
    Page<ConversationSummaryRow> findConversationSummaries(Pageable pageable);

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
                           (
                               SELECT w5.message_type
                               FROM whatsapp_messages w5
                               WHERE w5.phone_number = w.phone_number
                               ORDER BY w5.created_at DESC
                               LIMIT 1
                           ) AS lastMessageType,
                           MAX(w.created_at) AS lastMessageAt,
                           (
                               SELECT COUNT(*)
                               FROM whatsapp_messages wi
                               WHERE wi.phone_number = w.phone_number
                                 AND wi.direction = 'INBOUND'
                                 AND wi.created_at > COALESCE(
                                     (SELECT r.last_read_at
                                      FROM whatsapp_conversation_read r
                                      WHERE r.phone_number = w.phone_number),
                                     TIMESTAMP('1970-01-01 00:00:00.000'))
                           ) AS unreadCount
                    FROM whatsapp_messages w
                    WHERE w.phone_number NOT IN (
                        SELECT wm.phone_number
                        FROM whatsapp_messages wm
                        GROUP BY wm.phone_number
                        HAVING SUM(CASE WHEN wm.direction = 'INBOUND' THEN 1 ELSE 0 END) = 0
                           AND SUM(CASE WHEN wm.template_name IS NULL
                                         OR wm.template_name NOT IN ('felicitacao_aniversario', 'cobranca_pagamento')
                                    THEN 1 ELSE 0 END) = 0
                           AND COUNT(*) > 0
                    )
                    GROUP BY w.phone_number
                    ORDER BY lastMessageAt DESC
                    """,
            countQuery =
                    """
                    SELECT COUNT(*) FROM (
                        SELECT w.phone_number
                        FROM whatsapp_messages w
                        WHERE w.phone_number NOT IN (
                            SELECT wm.phone_number
                            FROM whatsapp_messages wm
                            GROUP BY wm.phone_number
                            HAVING SUM(CASE WHEN wm.direction = 'INBOUND' THEN 1 ELSE 0 END) = 0
                               AND SUM(CASE WHEN wm.template_name IS NULL
                                             OR wm.template_name NOT IN ('felicitacao_aniversario', 'cobranca_pagamento')
                                        THEN 1 ELSE 0 END) = 0
                               AND COUNT(*) > 0
                        )
                        GROUP BY w.phone_number
                    ) t
                    """,
            nativeQuery = true)
    Page<ConversationSummaryRow> findConversationSummariesExcluindoAniversario(Pageable pageable);

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
                               SELECT w3.content
                               FROM whatsapp_messages w3
                               WHERE w3.phone_number = w.phone_number
                               ORDER BY w3.created_at DESC
                               LIMIT 1
                           ) AS lastMessageContent,
                           (
                               SELECT w4.message_type
                               FROM whatsapp_messages w4
                               WHERE w4.phone_number = w.phone_number
                               ORDER BY w4.created_at DESC
                               LIMIT 1
                           ) AS lastMessageType,
                           MAX(w.created_at) AS lastMessageAt,
                           COUNT(*) AS totalMessages,
                           (
                               SELECT COUNT(*)
                               FROM whatsapp_messages wi
                               WHERE wi.phone_number = w.phone_number
                                 AND wi.direction = 'INBOUND'
                                 AND wi.created_at > COALESCE(
                                     (SELECT r.last_read_at
                                      FROM whatsapp_conversation_read r
                                      WHERE r.phone_number = w.phone_number),
                                     TIMESTAMP('1970-01-01 00:00:00.000'))
                           ) AS unreadCount
                    FROM whatsapp_messages w
                    WHERE EXISTS (
                        SELECT 1
                        FROM whatsapp_messages wi
                        WHERE wi.phone_number = w.phone_number
                          AND wi.direction = 'INBOUND'
                    )
                    GROUP BY w.phone_number
                    ORDER BY lastMessageAt DESC
                    """,
            nativeQuery = true)
    List<RecentConversationRow> findRecentConversationsWithInbound(Pageable pageable);

    /**
     * Número de conversas (telefones distintos) com ao menos uma INBOUND não lida
     * (created_at posterior a last_read_at global da conversa).
     */
    @Query(
            value =
                    """
                    SELECT COUNT(DISTINCT wi.phone_number)
                    FROM whatsapp_messages wi
                    WHERE wi.direction = 'INBOUND'
                      AND wi.created_at > COALESCE(
                          (SELECT r.last_read_at
                           FROM whatsapp_conversation_read r
                           WHERE r.phone_number = wi.phone_number),
                          TIMESTAMP('1970-01-01 00:00:00.000'))
                    """,
            nativeQuery = true)
    Long countConversasComInboundNaoLido();

    Page<WhatsAppMessageEntity> findByPhoneNumberOrderByCreatedAtDesc(String phoneNumber, Pageable pageable);

    @Query(
            value =
                    """
                    SELECT m.* FROM whatsapp_messages m
                    WHERE RIGHT(m.phone_number, 11) = :suffix11
                       OR RIGHT(m.phone_number, 10) = RIGHT(:suffix11, 10)
                    ORDER BY m.created_at DESC
                    """,
            nativeQuery = true)
    List<WhatsAppMessageEntity> findByPhoneSuffixOrderByCreatedAtDesc(@Param("suffix11") String suffix11);

    List<WhatsAppMessageEntity> findByPhoneNumberAndCreatedAtAfterOrderByCreatedAtAsc(
            String phoneNumber, Instant after);

    Optional<WhatsAppMessageEntity> findByWaMessageId(String waMessageId);

    Page<WhatsAppMessageEntity> findByClienteIdOrderByCreatedAtDesc(Long clienteId, Pageable pageable);

    Optional<WhatsAppMessageEntity> findFirstByPhoneNumberAndDirectionAndProcessoIdIsNotNullAndCreatedAtAfterOrderByCreatedAtDesc(
            String phoneNumber, WhatsAppMessageDirection direction, Instant since);

    Optional<WhatsAppMessageEntity> findFirstByPhoneNumberAndDirectionAndClienteIdIsNotNullAndCreatedAtAfterOrderByCreatedAtDesc(
            String phoneNumber, WhatsAppMessageDirection direction, Instant since);

    long countByDirectionAndCreatedAtAfter(WhatsAppMessageDirection direction, Instant after);

    long countByStatusAndCreatedAtAfter(WhatsAppMessageStatus status, Instant after);

    /**
     * Mídia inbound recuperável — apenas {@link WhatsAppMediaStatus#PENDING} (opção A: FAILED não retenta).
     * Restrito a {@link WhatsAppMessageDirection#INBOUND} — outbound tem fluxo Drive próprio (Fatia 3).
     * Usa índice {@code (media_status, created_at)}.
     */
    @Query(
            """
            SELECT m FROM WhatsAppMessageEntity m
            WHERE m.mediaId IS NOT NULL
              AND m.mediaId <> ''
              AND m.mediaStatus = :status
              AND m.direction = :direction
              AND (m.mediaLastAttemptAt IS NULL OR m.mediaLastAttemptAt < :tentativaAntesDe)
            ORDER BY m.createdAt ASC
            """)
    List<WhatsAppMessageEntity> findMidiaPendenteParaReprocessamento(
            @Param("status") WhatsAppMediaStatus status,
            @Param("direction") WhatsAppMessageDirection direction,
            @Param("tentativaAntesDe") Instant tentativaAntesDe,
            Pageable pageable);
}
