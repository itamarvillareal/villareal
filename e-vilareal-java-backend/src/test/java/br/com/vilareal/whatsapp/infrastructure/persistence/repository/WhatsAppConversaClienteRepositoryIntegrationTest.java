package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import br.com.vilareal.AbstractIntegrationTest;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppConversaClienteEntity;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Transactional
class WhatsAppConversaClienteRepositoryIntegrationTest extends AbstractIntegrationTest {

    private static final String PHONE_PREFIX = "55119977";

    @Autowired
    private WhatsAppConversaClienteRepository repository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @AfterEach
    void limparDadosTeste() {
        jdbcTemplate.update(
                "DELETE FROM whatsapp_conversa_cliente WHERE phone_number LIKE ?",
                PHONE_PREFIX + "%");
        jdbcTemplate.update(
                "DELETE FROM whatsapp_messages WHERE phone_number LIKE ?",
                PHONE_PREFIX + "%");
    }

    @Test
    void deleteByPhoneNumber_saveAll_e_findByPhoneNumberIn() {
        String phoneA = PHONE_PREFIX + "0001";
        String phoneB = PHONE_PREFIX + "0002";
        Instant agora = Instant.parse("2026-07-04T10:00:00Z");

        repository.saveAll(List.of(
                linha(phoneA, "00000001", "Cliente A", agora),
                linha(phoneA, "00000002", "Cliente B", agora),
                linha(phoneB, "00000003", "Cliente C", agora)));

        List<WhatsAppConversaClienteEntity> porPhones =
                repository.findByPhoneNumberIn(List.of(phoneA, phoneB));
        assertThat(porPhones).hasSize(3);

        int deleted = repository.deleteByPhoneNumber(phoneA);
        assertThat(deleted).isEqualTo(2);
        assertThat(repository.findByPhoneNumberIn(List.of(phoneA))).isEmpty();
        assertThat(repository.findByPhoneNumberIn(List.of(phoneB))).hasSize(1);
    }

    @Test
    void deleteFlushSaveAll_mesmaUk_comLinhaAntiga_naoViolaConstraint() {
        String phone = PHONE_PREFIX + "0632";
        Instant antigo = Instant.parse("2026-07-04T09:00:00Z");
        Instant novo = Instant.parse("2026-07-05T09:00:00Z");

        repository.save(linha(phone, "00000632", "Antigo", antigo));
        repository.flush();

        repository.deleteByPhoneNumber(phone);
        repository.flush();
        repository.saveAll(List.of(linha(phone, "00000632", "Novo", novo)));
        repository.flush();

        assertThat(repository.findByPhoneNumber(phone))
                .singleElement()
                .satisfies(row -> {
                    assertThat(row.getClienteCodigo()).isEqualTo("00000632");
                    assertThat(row.getClienteNome()).isEqualTo("Novo");
                    assertThat(row.getAtualizadoEm()).isEqualTo(novo);
                });
    }

    @Test
    void findDistinctClientes_retornaCodigosUnicosOrdenados() {
        String phoneA = PHONE_PREFIX + "0010";
        String phoneB = PHONE_PREFIX + "0011";
        Instant agora = Instant.parse("2026-07-04T11:00:00Z");

        repository.saveAll(List.of(
                linha(phoneA, "00000010", "Zeta", agora),
                linha(phoneA, "00000005", "Alfa", agora),
                linha(phoneB, "00000010", "Zeta", agora)));

        List<WhatsAppConversaClienteRepository.ClienteDistinctRow> distintos = repository.findDistinctClientes();
        List<String> codigos = distintos.stream()
                .map(WhatsAppConversaClienteRepository.ClienteDistinctRow::getClienteCodigo)
                .filter(c -> c.startsWith("0000000"))
                .toList();

        assertThat(codigos).containsExactly("00000005", "00000010");
    }

    private static WhatsAppConversaClienteEntity linha(
            String phone, String codigo, String nome, Instant atualizadoEm) {
        WhatsAppConversaClienteEntity entity = new WhatsAppConversaClienteEntity();
        entity.setPhoneNumber(phone);
        entity.setClienteCodigo(codigo);
        entity.setClienteNome(nome);
        entity.setAtualizadoEm(atualizadoEm);
        return entity;
    }
}
