package br.com.vilareal.db.migration;

import br.com.vilareal.agendamento.domain.TipoCadencia;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.AgendamentoConsultaRepository;
import br.com.vilareal.notificacao.domain.CanalNotificacao;
import br.com.vilareal.notificacao.infrastructure.persistence.entity.NotificacaoDestinatarioEntity;
import br.com.vilareal.notificacao.infrastructure.persistence.repository.NotificacaoDestinatarioRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.support.DockerCiGateExtension;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercita o UPDATE do V100 em MySQL real (Testcontainers). H2 não cobre o bug NOT IN + NULL.
 * {@code agendamento_consulta.processo_id} é NOT NULL (V93); o ramo NULL usa
 * {@code notificacao_destinatario.processo_id} (nullable, V96).
 */
@ExtendWith(DockerCiGateExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class V100ConsultaPeriodicaHabilitadaBackfillIntegrationTest {

    private static final String V100_UPDATE =
            """
            UPDATE processo p
            SET p.consulta_periodica_habilitada = 0
            WHERE p.consulta_periodica_habilitada = 1
              AND NOT EXISTS (SELECT 1 FROM agendamento_consulta a WHERE a.processo_id = p.id)
              AND NOT EXISTS (SELECT 1 FROM notificacao_destinatario n WHERE n.processo_id = p.id)
            """;

    /**
     * NOT IN sem filtro NULL em notificacao_destinatario: uma linha com processo_id NULL
     * contamina o predicado (UNKNOWN) e o UPDATE não afeta nenhuma linha.
     */
    private static final String V100_UPDATE_LEGADO_NOT_IN =
            """
            UPDATE processo
            SET consulta_periodica_habilitada = 0
            WHERE consulta_periodica_habilitada = 1
              AND id NOT IN (SELECT DISTINCT processo_id FROM agendamento_consulta)
              AND id NOT IN (SELECT DISTINCT processo_id FROM notificacao_destinatario)
            """;

    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0.36");

    @DynamicPropertySource
    static void registerProps(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", MYSQL::getJdbcUrl);
        r.add("spring.datasource.username", MYSQL::getUsername);
        r.add("spring.datasource.password", MYSQL::getPassword);
    }

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ProcessoRepository processoRepository;

    @Autowired
    private AgendamentoConsultaRepository agendamentoConsultaRepository;

    @Autowired
    private NotificacaoDestinatarioRepository notificacaoDestinatarioRepository;

    private ProcessoEntity processoA;
    private ProcessoEntity processoB;
    private ProcessoEntity processoC;

    @BeforeEach
    void prepararTresProcessos() {
        ProcessoEntity modelo = processoRepository.findAll(PageRequest.of(0, 1)).stream()
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("banco de teste sem processo base"));

        processoA = clonarProcesso(modelo, 91001);
        processoB = clonarProcesso(modelo, 91002);
        processoC = clonarProcesso(modelo, 91003);

        for (ProcessoEntity p : List.of(processoA, processoB, processoC)) {
            p.setConsultaPeriodicaHabilitada(true);
            p.setNumeroCnj("v100-" + UUID.randomUUID().toString().substring(0, 8) + ".8.09.0001");
        }
        processoRepository.saveAllAndFlush(List.of(processoA, processoB, processoC));

        limparConfig(processoA.getId());
        limparConfig(processoB.getId());
        limparConfig(processoC.getId());

        for (ProcessoEntity p : List.of(processoA, processoB, processoC)) {
            p.setConsultaPeriodicaHabilitada(true);
        }
        processoRepository.saveAllAndFlush(List.of(processoA, processoB, processoC));

        AgendamentoConsultaEntity ag = new AgendamentoConsultaEntity();
        ag.setProcesso(processoA);
        ag.setTipoCadencia(TipoCadencia.INTERVALO);
        ag.setIntervaloMinutos(30);
        ag.setProximaExecucao(LocalDateTime.now().plusHours(1));
        ag.setCriadoPor("v100-test");
        agendamentoConsultaRepository.saveAndFlush(ag);

        NotificacaoDestinatarioEntity destB = new NotificacaoDestinatarioEntity();
        destB.setProcesso(processoB);
        destB.setCanal(CanalNotificacao.EMAIL);
        destB.setValor("v100-b@teste.com");
        destB.setAtivo(true);
        notificacaoDestinatarioRepository.saveAndFlush(destB);

        // Destinatário global: processo_id NULL em notificacao_destinatario (coluna nullable — V96).
        NotificacaoDestinatarioEntity destGlobalNull = new NotificacaoDestinatarioEntity();
        destGlobalNull.setProcesso(null);
        destGlobalNull.setCanal(CanalNotificacao.EMAIL);
        destGlobalNull.setValor("global-v100@teste.com");
        destGlobalNull.setAtivo(true);
        notificacaoDestinatarioRepository.saveAndFlush(destGlobalNull);

        assertThat(jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM notificacao_destinatario WHERE processo_id IS NULL",
                        Integer.class))
                .isGreaterThanOrEqualTo(1);
    }

    @Test
    @Transactional
    void v100UpdateNotExists_preservaComConfigReal_zeraseSoFlag() {
        int atualizados = jdbcTemplate.update(V100_UPDATE);
        assertThat(atualizados).isEqualTo(1);

        assertThat(flag(processoA.getId())).isTrue();
        assertThat(flag(processoB.getId())).isTrue();
        assertThat(flag(processoC.getId())).isFalse();

        Integer mantidos = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM processo WHERE id IN (?,?,?) AND consulta_periodica_habilitada = 1",
                Integer.class,
                processoA.getId(),
                processoB.getId(),
                processoC.getId());
        assertThat(mantidos).isEqualTo(2);
    }

    @Test
    @Transactional
    void v100UpdateLegadoNotIn_comDestinatarioGlobalNull_eNoOp() {
        int atualizadosLegado = jdbcTemplate.update(V100_UPDATE_LEGADO_NOT_IN);
        assertThat(atualizadosLegado).isZero();

        assertThat(flag(processoA.getId())).isTrue();
        assertThat(flag(processoB.getId())).isTrue();
        assertThat(flag(processoC.getId())).isTrue();
    }

    private Boolean flag(Long processoId) {
        return jdbcTemplate.queryForObject(
                "SELECT consulta_periodica_habilitada FROM processo WHERE id = ?",
                Boolean.class,
                processoId);
    }

    private static ProcessoEntity clonarProcesso(ProcessoEntity modelo, int numeroInterno) {
        ProcessoEntity p = new ProcessoEntity();
        p.setPessoa(modelo.getPessoa());
        p.setCliente(modelo.getCliente());
        p.setNumeroInterno(numeroInterno);
        p.setAtivo(true);
        p.setConsultaAutomatica(false);
        p.setConsultaPeriodicaHabilitada(false);
        return p;
    }

    private void limparConfig(Long processoId) {
        agendamentoConsultaRepository.findByProcessoId(processoId).forEach(agendamentoConsultaRepository::delete);
        notificacaoDestinatarioRepository.deleteByProcessoId(processoId);
    }
}
