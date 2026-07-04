package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import br.com.vilareal.AbstractIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Transactional
class WhatsAppContactPhotoRepositoryIntegrationTest extends AbstractIntegrationTest {

    private static final String PHONE_PREFIX = "55119977";

    @Autowired
    private WhatsAppContactPhotoRepository contactPhotoRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @AfterEach
    void limparDadosTeste() {
        jdbcTemplate.update(
                "DELETE FROM whatsapp_contact_photo WHERE phone_number LIKE ?",
                PHONE_PREFIX + "%");
    }

    @Test
    void upsert_delete_e_findByPhoneNumberIn() {
        String phone1 = PHONE_PREFIX + "0001";
        String phone2 = PHONE_PREFIX + "0002";
        Instant t1 = Instant.parse("2026-06-01T10:00:00Z");
        Instant t2 = Instant.parse("2026-06-02T10:00:00Z");

        contactPhotoRepository.upsert(phone1, "file-a", "https://drive/a", t1);
        assertThat(contactPhotoRepository.findById(phone1)).isPresent();
        assertThat(contactPhotoRepository.findById(phone1).orElseThrow().getDriveFileId()).isEqualTo("file-a");

        contactPhotoRepository.upsert(phone1, "file-b", "https://drive/b", t2);
        assertThat(contactPhotoRepository.findById(phone1).orElseThrow().getDriveFileId()).isEqualTo("file-b");

        contactPhotoRepository.upsert(phone2, "file-c", null, t1);

        List<String> phones = List.of(phone1, phone2, PHONE_PREFIX + "9999");
        assertThat(contactPhotoRepository.findByPhoneNumberIn(phones)).hasSize(2);

        int deleted = contactPhotoRepository.deleteByPhoneNumber(phone1);
        assertThat(deleted).isEqualTo(1);
        assertThat(contactPhotoRepository.findById(phone1)).isEmpty();
        assertThat(contactPhotoRepository.deleteByPhoneNumber(phone1)).isZero();
    }
}
