package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import br.com.vilareal.AbstractIntegrationTest;
import br.com.vilareal.whatsapp.ConversaClienteManualAcao;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppConversaClienteEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppConversaClienteManualEntity;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppGrupoManualFilterRepositoryIntegrationTest extends AbstractIntegrationTest {

    private static final String PHONE_PREFIX = "55119955";
    private static final String COD_TERRA = "00000030";

    @Autowired
    private WhatsAppMessageRepository messageRepository;

    @Autowired
    private WhatsAppConversaClienteRepository automaticoRepository;

    @Autowired
    private WhatsAppConversaClienteManualRepository manualRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @AfterEach
    void limpar() {
        jdbcTemplate.update("DELETE FROM whatsapp_conversa_cliente_manual WHERE phone_number LIKE ?", PHONE_PREFIX + "%");
        jdbcTemplate.update("DELETE FROM whatsapp_conversa_cliente WHERE phone_number LIKE ?", PHONE_PREFIX + "%");
        jdbcTemplate.update("DELETE FROM whatsapp_messages WHERE phone_number LIKE ?", PHONE_PREFIX + "%");
    }

    @Test
    void incluirManualConversaApareceNaAba() {
        String phone = PHONE_PREFIX + "0001";
        inserirInbound(phone);
        manualRepository.save(manual(phone, COD_TERRA, "Terra Mundi", ConversaClienteManualAcao.INCLUIR));

        Page<ConversationSummaryRow> filtrada =
                messageRepository.findConversationSummariesExcluindoAniversario(
                        false, COD_TERRA, PageRequest.of(0, 200));
        assertThat(filtrada.getContent().stream()
                        .map(ConversationSummaryRow::getPhoneNumber)
                        .filter(p -> p.startsWith(PHONE_PREFIX)))
                .containsExactly(phone);
    }

    @Test
    void vinculoAutomaticoSemInclusaoManualNaoApareceNaAba() {
        String phone = PHONE_PREFIX + "0002";
        inserirInbound(phone);
        automaticoRepository.save(auto(phone, COD_TERRA, "Terra Mundi"));

        Page<ConversationSummaryRow> filtrada =
                messageRepository.findConversationSummariesExcluindoAniversario(
                        false, COD_TERRA, PageRequest.of(0, 200));
        assertThat(filtrada.getContent().stream()
                        .map(ConversationSummaryRow::getPhoneNumber)
                        .filter(p -> p.startsWith(PHONE_PREFIX)))
                .doesNotContain(phone);
    }

    @Test
    void listarGruposEfetivosConsideraInclusaoManual() {
        String phone = PHONE_PREFIX + "0003";
        manualRepository.save(manual(phone, COD_TERRA, "Terra Mundi", ConversaClienteManualAcao.INCLUIR));

        var grupos = manualRepository.listarGruposEfetivosComContagem();
        var terra = grupos.stream()
                .filter(g -> COD_TERRA.equals(g.getClienteCodigo().trim()))
                .findFirst();
        assertThat(terra).isPresent();
        assertThat(terra.orElseThrow().getQtdConversas()).isEqualTo(1L);
    }

    private static WhatsAppConversaClienteEntity auto(String phone, String codigo, String nome) {
        WhatsAppConversaClienteEntity e = new WhatsAppConversaClienteEntity();
        e.setPhoneNumber(phone);
        e.setClienteCodigo(codigo);
        e.setClienteNome(nome);
        e.setAtualizadoEm(Instant.now());
        return e;
    }

    private static WhatsAppConversaClienteManualEntity manual(
            String phone, String codigo, String nome, ConversaClienteManualAcao acao) {
        WhatsAppConversaClienteManualEntity e = new WhatsAppConversaClienteManualEntity();
        e.setPhoneNumber(phone);
        e.setClienteCodigo(codigo);
        e.setClienteNome(nome);
        e.setAcao(acao);
        e.setCriadoPor("test");
        e.setCriadoEm(Instant.now());
        return e;
    }

    private void inserirInbound(String phone) {
        jdbcTemplate.update(
                """
                INSERT INTO whatsapp_messages
                    (phone_number, direction, message_type, status, content, created_at, wa_message_id)
                VALUES (?, 'INBOUND', 'TEXT', 'DELIVERED', 'teste manual', ?, ?)
                """,
                phone,
                Timestamp.from(Instant.now().truncatedTo(ChronoUnit.SECONDS)),
                "wa-man-" + UUID.randomUUID());
    }
}
