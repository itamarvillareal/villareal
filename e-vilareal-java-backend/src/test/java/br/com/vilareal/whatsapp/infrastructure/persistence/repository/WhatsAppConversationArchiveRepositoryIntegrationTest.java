package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import br.com.vilareal.AbstractIntegrationTest;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository.ConversationSummaryRow;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppConversationArchiveRepositoryIntegrationTest extends AbstractIntegrationTest {

    private static final String PHONE_ARCHIVE_TEST_PREFIX = "55119977";

    @Autowired
    private WhatsAppConversationArchiveRepository archiveRepository;

    @Autowired
    private WhatsAppMessageRepository messageRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @AfterEach
    void limparDadosTeste() {
        jdbcTemplate.update(
                "DELETE FROM whatsapp_messages WHERE phone_number LIKE ?",
                PHONE_ARCHIVE_TEST_PREFIX + "%");
        jdbcTemplate.update(
                "DELETE FROM whatsapp_conversation_archive WHERE phone_number LIKE ?",
                PHONE_ARCHIVE_TEST_PREFIX + "%");
    }

    @Test
    void upsert_delete_e_exists() {
        String phone = PHONE_ARCHIVE_TEST_PREFIX + "0001";
        Instant t1 = Instant.parse("2026-06-01T10:00:00Z");

        archiveRepository.upsertArchivedAt(phone, t1);
        assertThat(archiveRepository.existsById(phone)).isTrue();

        int deleted = archiveRepository.deleteByPhoneNumber(phone);
        assertThat(deleted).isEqualTo(1);
        assertThat(archiveRepository.existsById(phone)).isFalse();
        assertThat(archiveRepository.deleteByPhoneNumber(phone)).isZero();
    }

    @Test
    void arquivadaNaoApareceNaListaPadrao_apareceNoModoArquivadas() {
        String phone = PHONE_ARCHIVE_TEST_PREFIX + "0002";
        Instant agora = Instant.now().truncatedTo(ChronoUnit.SECONDS);

        inserirInbound(phone, agora);
        archiveRepository.upsertArchivedAt(phone, agora);

        Page<ConversationSummaryRow> ativas =
                messageRepository.findConversationSummariesExcluindoAniversario(false, "", PageRequest.of(0, 200));
        assertThat(ativas.getContent().stream()
                        .map(ConversationSummaryRow::getPhoneNumber)
                        .filter(p -> p.startsWith(PHONE_ARCHIVE_TEST_PREFIX)))
                .doesNotContain(phone);

        Page<ConversationSummaryRow> arquivadas =
                messageRepository.findConversationSummariesExcluindoAniversario(true, "", PageRequest.of(0, 200));
        assertThat(arquivadas.getContent().stream()
                        .map(ConversationSummaryRow::getPhoneNumber)
                        .filter(p -> p.startsWith(PHONE_ARCHIVE_TEST_PREFIX)))
                .containsExactly(phone);
    }

    private void inserirInbound(String phone, Instant createdAt) {
        jdbcTemplate.update(
                """
                INSERT INTO whatsapp_messages
                    (phone_number, direction, message_type, status, content, created_at, wa_message_id)
                VALUES (?, 'INBOUND', 'TEXT', 'DELIVERED', 'teste archive', ?, ?)
                """,
                phone,
                Timestamp.from(createdAt),
                "wa-arch-" + UUID.randomUUID());
    }
}
