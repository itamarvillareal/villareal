package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppConversationReadEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface WhatsAppConversationReadRepository extends JpaRepository<WhatsAppConversationReadEntity, String> {

    @Modifying
    @Query(
            value =
                    """
                    INSERT INTO whatsapp_conversation_read (phone_number, last_read_at, updated_at)
                    VALUES (:phoneNumber, :lastReadAt, :lastReadAt)
                    ON DUPLICATE KEY UPDATE
                        last_read_at = VALUES(last_read_at),
                        updated_at = VALUES(last_read_at)
                    """,
            nativeQuery = true)
    void upsertLastReadAt(@Param("phoneNumber") String phoneNumber, @Param("lastReadAt") Instant lastReadAt);

    @Modifying
    @Query(value = "DELETE FROM whatsapp_conversation_read WHERE phone_number = :phoneNumber", nativeQuery = true)
    int deleteByPhoneNumber(@Param("phoneNumber") String phoneNumber);
}
