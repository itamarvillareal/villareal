package br.com.vilareal.processo.copiaidle.application;

import br.com.vilareal.pje.application.PjeCopiaIntegralPorProcessoService;
import br.com.vilareal.processo.application.ProcessoProjudiMovimentacoesDriveService;
import br.com.vilareal.processo.copiaidle.config.CopiaMovimentacoesClienteIdleProperties;
import br.com.vilareal.processo.copiaidle.infrastructure.persistence.repository.CopiaMovimentacoesClienteItemRepository;
import br.com.vilareal.projudi.ProjudiOrquestradorGate;
import br.com.vilareal.projudi.ProjudiSessionService;
import br.com.vilareal.robot.RobotGlobalLock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class CopiaMovimentacoesClienteIdleServiceTest {

    @Mock
    private CopiaMovimentacoesClienteIdleStore store;
    @Mock
    private CopiaMovimentacoesClienteItemRepository itemRepository;
    @Mock
    private ProcessoProjudiMovimentacoesDriveService projudiMovimentacoesDriveService;
    @Mock
    private PjeCopiaIntegralPorProcessoService pjeCopiaIntegralPorProcessoService;
    @Mock
    private ProjudiSessionService sessionService;

    private ProjudiOrquestradorGate projudiGate;
    private RobotGlobalLock robotGlobalLock;
    private CopiaMovimentacoesClienteIdleProperties properties;
    private CopiaMovimentacoesClienteIdleService service;

    @BeforeEach
    void setUp() {
        projudiGate = new ProjudiOrquestradorGate();
        robotGlobalLock = new RobotGlobalLock();
        properties = new CopiaMovimentacoesClienteIdleProperties();
        properties.setHoraInicio(1);
        properties.setHoraFim(6);
        properties.setZone("America/Sao_Paulo");
        properties.setCodigoCliente("728");
    }

    private void montarComClock(Instant instant) {
        Clock clock = Clock.fixed(instant, ZoneId.of("America/Sao_Paulo"));
        service = new CopiaMovimentacoesClienteIdleService(
                properties,
                store,
                itemRepository,
                projudiMovimentacoesDriveService,
                pjeCopiaIntegralPorProcessoService,
                projudiGate,
                robotGlobalLock,
                sessionService,
                clock,
                1L);
    }

    @Test
    void normalizarCodigoCliente_completaOitoDigitos() {
        assertThat(CopiaMovimentacoesClienteIdleService.normalizarCodigoCliente("728")).isEqualTo("00000728");
        assertThat(CopiaMovimentacoesClienteIdleService.normalizarCodigoCliente("00000728")).isEqualTo("00000728");
    }

    @Test
    void estaNaJanelaMadrugada_aceitaEntre1e5() {
        // 2026-07-23 03:00 America/Sao_Paulo = 06:00 UTC
        montarComClock(LocalDateTime.of(2026, 7, 23, 3, 0).atZone(ZoneId.of("America/Sao_Paulo")).toInstant());
        assertThat(service.estaNaJanelaMadrugada()).isTrue();
    }

    @Test
    void estaNaJanelaMadrugada_rejeitaFora() {
        montarComClock(LocalDateTime.of(2026, 7, 23, 10, 0).atZone(ZoneId.of("America/Sao_Paulo")).toInstant());
        assertThat(service.estaNaJanelaMadrugada()).isFalse();
    }

    @Test
    void sistemaOcioso_falseQuandoGateProjudiOcupado() {
        montarComClock(Instant.parse("2026-07-23T06:00:00Z"));
        assertThat(service.sistemaOcioso()).isTrue();
        projudiGate.tryLock();
        try {
            assertThat(service.sistemaOcioso()).isFalse();
        } finally {
            projudiGate.unlock();
        }
    }

    @Test
    void executarTick_foraDaJanelaNaoChamaStore() {
        montarComClock(LocalDateTime.of(2026, 7, 23, 14, 0).atZone(ZoneId.of("America/Sao_Paulo")).toInstant());
        service.executarTick(null);
        org.mockito.Mockito.verifyNoInteractions(store);
    }
}
