package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import br.com.vilareal.AbstractIntegrationTest;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository.ConversationSummaryRow;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@Transactional
class WhatsAppConversationPinRepositoryIntegrationTest extends AbstractIntegrationTest {

    private static final String PHONE_PIN_TEST_PREFIX = "55119988";

    @Autowired
    private WhatsAppConversationPinRepository pinRepository;

    @Autowired
    private WhatsAppMessageRepository messageRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @AfterEach
    void limparDadosTeste() {
        jdbcTemplate.update(
                "DELETE FROM whatsapp_messages WHERE phone_number LIKE ?",
                PHONE_PIN_TEST_PREFIX + "%");
        jdbcTemplate.update(
                "DELETE FROM whatsapp_conversation_pin WHERE phone_number LIKE ?",
                PHONE_PIN_TEST_PREFIX + "%");
    }

    @Test
    void upsert_e_delete_sao_idempotentes() {
        String phone = PHONE_PIN_TEST_PREFIX + "0001";
        Instant t1 = Instant.parse("2026-06-01T10:00:00Z");
        Instant t2 = Instant.parse("2026-06-02T10:00:00Z");

        pinRepository.upsertPinnedAt(phone, t1);
        assertThat(pinRepository.findById(phone)).isPresent();
        assertThat(pinRepository.findById(phone).orElseThrow().getPinnedAt()).isEqualTo(t1);

        pinRepository.upsertPinnedAt(phone, t2);
        assertThat(pinRepository.findById(phone).orElseThrow().getPinnedAt()).isEqualTo(t2);

        int deleted = pinRepository.deleteByPhoneNumber(phone);
        assertThat(deleted).isEqualTo(1);
        assertThat(pinRepository.findById(phone)).isEmpty();

        int deletedAgain = pinRepository.deleteByPhoneNumber(phone);
        assertThat(deletedAgain).isEqualTo(0);
    }

    @Test
    void conversaFixadaApareceAntesDeNaoFixadaMaisRecente() {
        String phoneRecente = PHONE_PIN_TEST_PREFIX + "0002";
        String phoneFixadaAntiga = PHONE_PIN_TEST_PREFIX + "0003";
        Instant agora = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        Instant ontem = agora.minus(1, ChronoUnit.DAYS);

        inserirInbound(phoneRecente, agora, "wa-pin-recent");
        inserirInbound(phoneFixadaAntiga, ontem, "wa-pin-old");
        pinRepository.upsertPinnedAt(phoneFixadaAntiga, agora);

        Page<ConversationSummaryRow> page =
                messageRepository.findConversationSummariesExcluindoAniversario(false, "", PageRequest.of(0, 200));

        List<String> phones = page.getContent().stream()
                .map(ConversationSummaryRow::getPhoneNumber)
                .filter(p -> p.startsWith(PHONE_PIN_TEST_PREFIX))
                .toList();

        assertThat(phones).containsExactly(phoneFixadaAntiga, phoneRecente);
        assertThat(page.getContent().stream()
                        .filter(r -> phoneFixadaAntiga.equals(r.getPhoneNumber()))
                        .findFirst()
                        .orElseThrow()
                        .getPinned())
                .isEqualTo(1);
    }

    private void inserirInbound(String phone, Instant createdAt, String waId) {
        jdbcTemplate.update(
                """
                INSERT INTO whatsapp_messages
                    (phone_number, direction, message_type, status, content, created_at, wa_message_id)
                VALUES (?, 'INBOUND', 'TEXT', 'DELIVERED', 'teste pin', ?, ?)
                """,
                phone,
                Timestamp.from(createdAt),
                waId + "-" + UUID.randomUUID());
    }
}
