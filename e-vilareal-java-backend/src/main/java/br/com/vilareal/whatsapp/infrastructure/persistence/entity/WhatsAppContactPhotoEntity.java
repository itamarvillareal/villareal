package br.com.vilareal.whatsapp.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "whatsapp_contact_photo")
@Getter
@Setter
public class WhatsAppContactPhotoEntity {

    @Id
    @Column(name = "phone_number", length = 20)
    private String phoneNumber;

    @Column(name = "drive_file_id", nullable = false, length = 255)
    private String driveFileId;

    @Column(name = "drive_url", length = 500)
    private String driveUrl;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
