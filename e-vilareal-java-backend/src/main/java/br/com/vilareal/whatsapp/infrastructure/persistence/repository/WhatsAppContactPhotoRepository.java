package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppContactPhotoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface WhatsAppContactPhotoRepository extends JpaRepository<WhatsAppContactPhotoEntity, String> {

    List<WhatsAppContactPhotoEntity> findByPhoneNumberIn(Collection<String> phoneNumbers);

    // clearAutomatically: o upsert nativo não passa pela sessão Hibernate; sem limpar o contexto,
    // um findById subsequente na mesma transação devolveria a entidade obsoleta em cache.
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            value =
                    """
                    INSERT INTO whatsapp_contact_photo (phone_number, drive_file_id, drive_url, updated_at)
                    VALUES (:phoneNumber, :driveFileId, :driveUrl, :updatedAt)
                    ON DUPLICATE KEY UPDATE
                        drive_file_id = VALUES(drive_file_id),
                        drive_url = VALUES(drive_url),
                        updated_at = VALUES(updated_at)
                    """,
            nativeQuery = true)
    void upsert(
            @Param("phoneNumber") String phoneNumber,
            @Param("driveFileId") String driveFileId,
            @Param("driveUrl") String driveUrl,
            @Param("updatedAt") Instant updatedAt);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "DELETE FROM whatsapp_contact_photo WHERE phone_number = :phoneNumber", nativeQuery = true)
    int deleteByPhoneNumber(@Param("phoneNumber") String phoneNumber);
}
