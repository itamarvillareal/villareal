package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppConversationPinEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface WhatsAppConversationPinRepository extends JpaRepository<WhatsAppConversationPinEntity, String> {

    // clearAutomatically: o upsert nativo não passa pela sessão Hibernate; sem limpar o contexto,
    // um findById subsequente na mesma transação devolveria a entidade obsoleta em cache.
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            value =
                    """
                    INSERT INTO whatsapp_conversation_pin (phone_number, pinned_at, updated_at)
                    VALUES (:phoneNumber, :pinnedAt, :pinnedAt)
                    ON DUPLICATE KEY UPDATE
                        pinned_at = VALUES(pinned_at),
                        updated_at = VALUES(pinned_at)
                    """,
            nativeQuery = true)
    void upsertPinnedAt(@Param("phoneNumber") String phoneNumber, @Param("pinnedAt") Instant pinnedAt);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "DELETE FROM whatsapp_conversation_pin WHERE phone_number = :phoneNumber", nativeQuery = true)
    int deleteByPhoneNumber(@Param("phoneNumber") String phoneNumber);
}
