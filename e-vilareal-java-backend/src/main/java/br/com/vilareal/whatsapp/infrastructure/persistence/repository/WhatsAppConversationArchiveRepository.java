package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppConversationArchiveEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface WhatsAppConversationArchiveRepository extends JpaRepository<WhatsAppConversationArchiveEntity, String> {

    @Modifying
    @Query(
            value =
                    """
                    INSERT INTO whatsapp_conversation_archive (phone_number, archived_at, updated_at)
                    VALUES (:phoneNumber, :archivedAt, :archivedAt)
                    ON DUPLICATE KEY UPDATE
                        archived_at = VALUES(archived_at),
                        updated_at = VALUES(archived_at)
                    """,
            nativeQuery = true)
    void upsertArchivedAt(@Param("phoneNumber") String phoneNumber, @Param("archivedAt") Instant archivedAt);

    @Modifying
    @Query(value = "DELETE FROM whatsapp_conversation_archive WHERE phone_number = :phoneNumber", nativeQuery = true)
    int deleteByPhoneNumber(@Param("phoneNumber") String phoneNumber);
}
