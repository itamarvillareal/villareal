package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import br.com.vilareal.AbstractIntegrationTest;
import br.com.vilareal.whatsapp.ConversaClienteManualAcao;
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
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppGrupoFilterRepositoryIntegrationTest extends AbstractIntegrationTest {

    private static final String PHONE_PREFIX = "55119966";
    private static final String COD_FAROL = "00000010";
    private static final String COD_TERRA = "00000020";

    @Autowired
    private WhatsAppMessageRepository messageRepository;

    @Autowired
    private WhatsAppConversaClienteManualRepository manualRepository;

    @Autowired
    private WhatsAppConversationArchiveRepository archiveRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @AfterEach
    void limpar() {
        jdbcTemplate.update("DELETE FROM whatsapp_conversa_cliente_manual WHERE phone_number LIKE ?", PHONE_PREFIX + "%");
        jdbcTemplate.update("DELETE FROM whatsapp_conversation_archive WHERE phone_number LIKE ?", PHONE_PREFIX + "%");
        jdbcTemplate.update("DELETE FROM whatsapp_messages WHERE phone_number LIKE ?", PHONE_PREFIX + "%");
    }

    @Test
    void semClienteCodigo_listaIgualModoTodas() {
        String phoneFarol = PHONE_PREFIX + "0001";
        String phoneTerra = PHONE_PREFIX + "0002";
        Instant agora = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        inserirInbound(phoneFarol, agora);
        inserirInbound(phoneTerra, agora.plusSeconds(1));
        incluirManual(phoneFarol, COD_FAROL, "Farol");
        incluirManual(phoneTerra, COD_TERRA, "Terra Mundi");

        Page<ConversationSummaryRow> todas =
                messageRepository.findConversationSummariesExcluindoAniversario(false, "", PageRequest.of(0, 200));
        List<String> phones = todas.getContent().stream()
                .map(ConversationSummaryRow::getPhoneNumber)
                .filter(p -> p.startsWith(PHONE_PREFIX))
                .toList();

        assertThat(phones).containsExactlyInAnyOrder(phoneFarol, phoneTerra);
    }

    @Test
    void comClienteCodigo_filtraSomenteConversasDaqueleGrupo() {
        String phoneFarol = PHONE_PREFIX + "0003";
        String phoneTerra = PHONE_PREFIX + "0004";
        String phoneSemCliente = PHONE_PREFIX + "0005";
        Instant agora = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        inserirInbound(phoneFarol, agora);
        inserirInbound(phoneTerra, agora.plusSeconds(1));
        inserirInbound(phoneSemCliente, agora.plusSeconds(2));
        incluirManual(phoneFarol, COD_FAROL, "Farol");
        incluirManual(phoneTerra, COD_TERRA, "Terra Mundi");

        Page<ConversationSummaryRow> farol =
                messageRepository.findConversationSummariesExcluindoAniversario(
                        false, COD_FAROL, PageRequest.of(0, 200));
        assertThat(farol.getContent().stream()
                        .map(ConversationSummaryRow::getPhoneNumber)
                        .filter(p -> p.startsWith(PHONE_PREFIX)))
                .containsExactly(phoneFarol);

        Page<ConversationSummaryRow> terra =
                messageRepository.findConversationSummariesExcluindoAniversario(
                        false, COD_TERRA, PageRequest.of(0, 200));
        assertThat(terra.getContent().stream()
                        .map(ConversationSummaryRow::getPhoneNumber)
                        .filter(p -> p.startsWith(PHONE_PREFIX)))
                .containsExactly(phoneTerra);
    }

    @Test
    void filtroClienteCoexisteComArquivadas() {
        String phoneFarolAtiva = PHONE_PREFIX + "0006";
        String phoneFarolArquivada = PHONE_PREFIX + "0007";
        Instant agora = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        inserirInbound(phoneFarolAtiva, agora);
        inserirInbound(phoneFarolArquivada, agora.plusSeconds(1));
        incluirManual(phoneFarolAtiva, COD_FAROL, "Farol");
        incluirManual(phoneFarolArquivada, COD_FAROL, "Farol");
        archiveRepository.upsertArchivedAt(phoneFarolArquivada, agora);

        Page<ConversationSummaryRow> ativasFarol =
                messageRepository.findConversationSummariesExcluindoAniversario(
                        false, COD_FAROL, PageRequest.of(0, 200));
        assertThat(ativasFarol.getContent().stream()
                        .map(ConversationSummaryRow::getPhoneNumber)
                        .filter(p -> p.startsWith(PHONE_PREFIX)))
                .containsExactly(phoneFarolAtiva);

        Page<ConversationSummaryRow> arquivadasFarol =
                messageRepository.findConversationSummariesExcluindoAniversario(
                        true, COD_FAROL, PageRequest.of(0, 200));
        assertThat(arquivadasFarol.getContent().stream()
                        .map(ConversationSummaryRow::getPhoneNumber)
                        .filter(p -> p.startsWith(PHONE_PREFIX)))
                .containsExactly(phoneFarolArquivada);
    }

    @Test
    void listarGruposComContagem_retornaClientesDistintos() {
        String phoneA = PHONE_PREFIX + "0010";
        String phoneB = PHONE_PREFIX + "0011";
        incluirManual(phoneA, COD_FAROL, "Farol");
        incluirManual(phoneB, COD_FAROL, "Farol");
        incluirManual(phoneB, COD_TERRA, "Terra Mundi");

        var grupos = manualRepository.listarGruposEfetivosComContagem();
        var farol = grupos.stream()
                .filter(g -> COD_FAROL.equals(g.getClienteCodigo().trim()))
                .findFirst()
                .orElseThrow();
        assertThat(farol.getQtdConversas()).isEqualTo(2L);
    }

    private void incluirManual(String phone, String codigo, String nome) {
        manualRepository.save(manual(phone, codigo, nome, ConversaClienteManualAcao.INCLUIR));
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

    private void inserirInbound(String phone, Instant createdAt) {
        jdbcTemplate.update(
                """
                INSERT INTO whatsapp_messages
                    (phone_number, direction, message_type, status, content, created_at, wa_message_id)
                VALUES (?, 'INBOUND', 'TEXT', 'DELIVERED', 'teste grupo', ?, ?)
                """,
                phone,
                Timestamp.from(createdAt),
                "wa-grp-" + UUID.randomUUID());
    }
}
