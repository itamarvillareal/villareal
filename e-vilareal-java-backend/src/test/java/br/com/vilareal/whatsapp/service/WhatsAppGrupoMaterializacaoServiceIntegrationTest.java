package br.com.vilareal.whatsapp.service;

import br.com.vilareal.AbstractIntegrationTest;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppConversaClienteEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversaClienteRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WhatsAppGrupoMaterializacaoServiceIntegrationTest extends AbstractIntegrationTest {

    private static final String PHONE = "5511997706320";
    private static final Instant LINHA_ANTIGA = Instant.parse("2026-07-04T09:00:00Z");
    private static final Instant MATERIALIZACAO = Instant.parse("2026-07-05T12:00:00Z");

    @Autowired
    private WhatsAppConversaClienteRepository conversaClienteRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private WhatsAppVinculoService vinculoService;
    private WhatsAppGrupoMaterializacaoService service;

    @BeforeEach
    void setUp() {
        vinculoService = mock(WhatsAppVinculoService.class);
        service = new WhatsAppGrupoMaterializacaoService(
                mock(WhatsAppMessageRepository.class),
                conversaClienteRepository,
                vinculoService,
                transactionTemplate,
                Clock.fixed(MATERIALIZACAO, ZoneOffset.UTC));
    }

    @AfterEach
    void limpar() {
        jdbcTemplate.update("DELETE FROM whatsapp_conversa_cliente WHERE phone_number = ?", PHONE);
    }

    @Test
    void materializarTelefone_comLinhaAntigaMesmaUk_regravaSemViolacao() {
        gravarLinhaAntigaCommitada();

        when(vinculoService.resolverClientesPorTelefone(PHONE))
                .thenReturn(List.of(new WhatsAppVinculoService.ClienteVinculoResumo("00000632", "Novo nome")));

        int inseridos = service.materializarTelefone(PHONE);

        assertThat(inseridos).isEqualTo(1);
        assertThat(conversaClienteRepository.findByPhoneNumber(PHONE))
                .singleElement()
                .satisfies(row -> {
                    assertThat(row.getClienteCodigo()).isEqualTo("00000632");
                    assertThat(row.getClienteNome()).isEqualTo("Novo nome");
                    assertThat(row.getAtualizadoEm()).isEqualTo(MATERIALIZACAO);
                });
    }

    @Test
    void materializarTelefone_duasVezesSeguidas_idempotente() {
        gravarLinhaAntigaCommitada();
        when(vinculoService.resolverClientesPorTelefone(PHONE))
                .thenReturn(List.of(new WhatsAppVinculoService.ClienteVinculoResumo("00000632", "Nome final")));

        assertThat(service.materializarTelefone(PHONE)).isEqualTo(1);
        assertThat(service.materializarTelefone(PHONE)).isEqualTo(1);

        assertThat(conversaClienteRepository.findByPhoneNumber(PHONE))
                .singleElement()
                .extracting(WhatsAppConversaClienteEntity::getClienteNome)
                .isEqualTo("Nome final");
    }

    @Test
    void materializarTelefone_falhaAposDelete_preservaLinhaAntiga() {
        gravarLinhaAntigaCommitada();

        assertThatThrownBy(() -> transactionTemplate.executeWithoutResult(status -> {
                    conversaClienteRepository.deleteByPhoneNumber(PHONE);
                    conversaClienteRepository.flush();
                    throw new RuntimeException("falha simulada no insert");
                }))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("falha simulada");

        assertThat(conversaClienteRepository.findByPhoneNumber(PHONE))
                .singleElement()
                .satisfies(row -> {
                    assertThat(row.getClienteCodigo()).isEqualTo("00000632");
                    assertThat(row.getClienteNome()).isEqualTo("Antigo");
                    assertThat(row.getAtualizadoEm()).isEqualTo(LINHA_ANTIGA);
                });
    }

    private void gravarLinhaAntigaCommitada() {
        transactionTemplate.executeWithoutResult(status -> {
            WhatsAppConversaClienteEntity entity = new WhatsAppConversaClienteEntity();
            entity.setPhoneNumber(PHONE);
            entity.setClienteCodigo("00000632");
            entity.setClienteNome("Antigo");
            entity.setAtualizadoEm(LINHA_ANTIGA);
            conversaClienteRepository.save(entity);
            conversaClienteRepository.flush();
        });
    }
}
